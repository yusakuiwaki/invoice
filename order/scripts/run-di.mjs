#!/usr/bin/env node
// Minimal Azure Document Intelligence verifier (no SDK)
// - Scans ./input/*.pdf
// - Runs prebuilt-document and prebuilt-layout
// - Saves raw JSON to ./data/out
// - Prints extracted fields and table preview

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.resolve(__dirname, '..', 'input');
const OUT_DIR = path.resolve(__dirname, '..', 'data', 'out');
const SAMPLES_DIR = path.resolve(__dirname, '..', 'samples');

const AZURE_DI_ENDPOINT = process.env.AZURE_DI_ENDPOINT || '';
const AZURE_DI_KEY = process.env.AZURE_DI_KEY || '';
const API_VERSION = process.env.AZURE_DI_API_VERSION || '2023-07-31';

const argv = process.argv.slice(2);
const MOCK_MODE = argv.includes('--mock');

function ensureDirs() {
  fs.mkdirSync(INPUT_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function listPdfFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => path.join(dir, f));
}

async function analyzeWithModel(fileBuffer, modelId) {
  const url = `${AZURE_DI_ENDPOINT}/formrecognizer/documentModels/${modelId}:analyze?api-version=${API_VERSION}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'Ocp-Apim-Subscription-Key': AZURE_DI_KEY,
    },
    body: fileBuffer,
  });
  if (!res.ok && res.status !== 202) {
    const text = await res.text();
    throw new Error(`Analyze request failed: ${res.status} ${res.statusText} ${text}`);
  }
  const opLocation = res.headers.get('operation-location');
  if (!opLocation) throw new Error('Missing operation-location header');

  // Poll for result
  let attempt = 0;
  const maxAttempts = 30; // ~60s max
  const intervalMs = 2000;
  while (attempt < maxAttempts) {
    const r = await fetch(opLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': AZURE_DI_KEY },
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Polling failed: ${r.status} ${r.statusText} ${t}`);
    }
    const data = await r.json();
    if (data.status === 'succeeded') return data.analyzeResult || data;
    if (data.status === 'failed') throw new Error(`Analysis failed: ${JSON.stringify(data, null, 2)}`);
    await new Promise((res) => setTimeout(res, intervalMs));
    attempt++;
  }
  throw new Error('Timed out waiting for analysis result');
}

function saveJson(outPath, obj) {
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2));
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function normalizeText(s) {
  return (s || '').toString().toLowerCase();
}

function extractHeaderFieldsFromDocumentModel(docResult) {
  // Works with prebuilt-document output; try to find key-value pairs and common header fields.
  const headers = {
    order_no: null,
    customer_order_no: null,
    order_date: null,
    shipment_date: null,
    customer_name: null,
    ship_to: null,
    bill_to: null,
    contact_person: null,
    phone: null,
    supplier_name: null,
    supplier_address: null,
    currency: null,
    purchase_order_type: null,
  };

  const kv = Array.isArray(docResult.keyValuePairs) ? docResult.keyValuePairs : [];

  const setIfMatch = (keyText, valueText) => {
    const key = normalizeText(keyText || '');
    const val = (valueText || '').toString().trim();
    if (!val) return;
    if ((/\b(po|order)\s*(no\.?|number)\b/.test(key)) && !headers.order_no) headers.order_no = val;
    if ((/\b(customer)\s*(order)?\s*(no\.?|number)\b/.test(key)) && !headers.customer_order_no) headers.customer_order_no = val;
    if ((/\b(order|po)\s*date\b/.test(key)) && !headers.order_date) headers.order_date = val;
    if ((/\b(delivery|shipment|ship)\s*date\b/.test(key)) && !headers.shipment_date) headers.shipment_date = val;
    if ((/\b(customer|buyer|purchaser)\b/.test(key)) && !headers.customer_name) headers.customer_name = val;
    if ((/\bship\s*to\b/.test(key)) && !headers.ship_to) headers.ship_to = val;
    if ((/\bbill\s*to\b/.test(key)) && !headers.bill_to) headers.bill_to = val;
    if ((/\b(contact|attn|attention)\b/.test(key)) && !headers.contact_person) headers.contact_person = val;
    if ((/\bphone|tel\.?\b/.test(key)) && !headers.phone) headers.phone = val;
    if ((/\b(supplier|vendor)\b/.test(key)) && !headers.supplier_name) headers.supplier_name = val;
    if ((/\b(address)\b/.test(key)) && !headers.supplier_address) headers.supplier_address = val;
    if ((/\bcurrency\b/.test(key)) && !headers.currency) headers.currency = val;
    if ((/\b(order|purchase)\s*(type|category|class)\b/.test(key)) && !headers.purchase_order_type) headers.purchase_order_type = val;
  };

  for (const pair of kv) {
    const k = pair.key?.content || pair.key?.text || '';
    const v = pair.value?.content || pair.value?.text || '';
    setIfMatch(k, v);
  }

  // Also scan documents[].fields if present
  if (Array.isArray(docResult.documents)) {
    for (const d of docResult.documents) {
      const fields = d.fields || {};
      for (const [fname, fval] of Object.entries(fields)) {
        const k = fname;
        const v = typeof fval === 'object' ? (fval?.content || fval?.value || fval?.text || '') : String(fval);
        setIfMatch(k, v);
      }
    }
  }

  return headers;
}

function extractTableFromLayout(layoutResult) {
  const tables = Array.isArray(layoutResult.tables) ? layoutResult.tables : [];
  if (!tables.length) return [];
  // Pick the largest table by cells count
  const largest = tables.reduce((a, b) => (a.cells?.length || 0) > (b.cells?.length || 0) ? a : b);
  const rows = largest.rowCount || 0;
  const cols = largest.columnCount || 0;
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
  for (const c of largest.cells || []) {
    const r = c.rowIndex ?? 0;
    const col = c.columnIndex ?? 0;
    grid[r][col] = (c.content || c.text || '').trim();
  }
  return grid;
}

function summarize(fileName, header, table) {
  const lines = [];
  lines.push(`\n=== ${fileName} ===`);
  lines.push('- Header Fields:');
  const keys = Object.keys(header);
  for (const k of keys) {
    if (header[k]) lines.push(`  ${k}: ${header[k]}`);
  }
  lines.push(`- Table: ${table.length} rows`);
  for (let i = 0; i < Math.min(5, table.length); i++) {
    lines.push(`  [${i}] ${table[i].join(' | ')}`);
  }
  return lines.join('\n');
}

async function runReal(files) {
  if (!AZURE_DI_ENDPOINT || !AZURE_DI_KEY) {
    console.error('Missing AZURE_DI_ENDPOINT or AZURE_DI_KEY');
    process.exit(1);
  }
  for (const f of files) {
    const base = path.basename(f, path.extname(f));
    const buf = fs.readFileSync(f);
    console.log(`Analyzing ${base} with prebuilt-document...`);
    const docRes = await analyzeWithModel(buf, 'prebuilt-document');
    const docOut = path.join(OUT_DIR, `${base}.prebuilt-document.json`);
    saveJson(docOut, docRes);
    console.log(`Saved: ${docOut}`);

    console.log(`Analyzing ${base} with prebuilt-layout...`);
    const layoutRes = await analyzeWithModel(buf, 'prebuilt-layout');
    const layoutOut = path.join(OUT_DIR, `${base}.prebuilt-layout.json`);
    saveJson(layoutOut, layoutRes);
    console.log(`Saved: ${layoutOut}`);

    const header = extractHeaderFieldsFromDocumentModel(docRes);
    const table = extractTableFromLayout(layoutRes);
    console.log(summarize(path.basename(f), header, table));
  }
}

async function runMock() {
  const docMock = path.join(SAMPLES_DIR, 'mock-document.json');
  const layoutMock = path.join(SAMPLES_DIR, 'mock-layout.json');
  const docRes = loadJson(docMock);
  const layoutRes = loadJson(layoutMock);
  const header = extractHeaderFieldsFromDocumentModel(docRes);
  const table = extractTableFromLayout(layoutRes);
  const base = 'MOCK.pdf';
  saveJson(path.join(OUT_DIR, 'MOCK.prebuilt-document.json'), docRes);
  saveJson(path.join(OUT_DIR, 'MOCK.prebuilt-layout.json'), layoutRes);
  console.log(summarize(base, header, table));
}

async function main() {
  ensureDirs();
  if (MOCK_MODE) {
    await runMock();
    return;
  }
  const files = listPdfFiles(INPUT_DIR);
  if (!files.length) {
    console.log('No PDFs found in ./input. Place PDFs there or run with --mock.');
    return;
  }
  await runReal(files);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


import JSZip from 'jszip';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

export type ZipFiles = JSZip;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: false,
  processEntities: true,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  suppressEmptyNode: true,
});

export async function loadXlsx(buffer: ArrayBuffer | Buffer): Promise<ZipFiles> {
  const zip = await JSZip.loadAsync(buffer as any);
  return zip;
}

export async function getText(zip: ZipFiles, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing entry: ${path}`);
  return await file.async('string');
}

export function setText(zip: ZipFiles, path: string, content: string) {
  zip.file(path, content);
}

export async function getFirstSheetPath(zip: ZipFiles): Promise<string> {
  const workbookXml = await getText(zip, 'xl/workbook.xml');
  const o = parser.parse(workbookXml);
  const sheets = o.workbook?.sheets?.sheet;
  const first = Array.isArray(sheets) ? sheets[0] : sheets;
  const relId = first?.['r:id'];
  if (!relId) throw new Error('Could not resolve first sheet r:id');
  const relsXml = await getText(zip, 'xl/_rels/workbook.xml.rels');
  const rels = parser.parse(relsXml);
  const relList = rels.Relationships?.Relationship || [];
  const arr = Array.isArray(relList) ? relList : [relList];
  const rel = arr.find((r: any) => r.Id === relId);
  if (!rel?.Target) throw new Error('Could not resolve sheet rel Target');
  const target: string = rel.Target;
  return target.startsWith('xl/') ? target : `xl/${target}`;
}

export async function getSheetPathByName(zip: ZipFiles, name: string): Promise<string> {
  const workbookXml = await getText(zip, 'xl/workbook.xml');
  const o = parser.parse(workbookXml);
  const sheets = o.workbook?.sheets?.sheet;
  const list = Array.isArray(sheets) ? sheets : [sheets];
  const targetSheet = list.find((s: any) => s?.name === name) || list[0];
  if (!targetSheet) throw new Error('No sheets in workbook');
  const relId = targetSheet['r:id'];
  const relsXml = await getText(zip, 'xl/_rels/workbook.xml.rels');
  const rels = parser.parse(relsXml);
  const relList = rels.Relationships?.Relationship || [];
  const arr = Array.isArray(relList) ? relList : [relList];
  const rel = arr.find((r: any) => r.Id === relId);
  if (!rel?.Target) throw new Error('Could not resolve sheet rel Target');
  const target: string = rel.Target;
  return target.startsWith('xl/') ? target : `xl/${target}`;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

export function normalizeNumber(input: string): string | null {
  const s = input.replace(/[,\s]/g, '');
  if (!/^[-+]?(?:\d+\.?\d*|\d*\.\d+)$/.test(s)) return null;
  return s;
}

function replaceCellString(sheetXml: string, addr: string, value: string): string {
  const esc = escapeXml(value);
  // Handle self-closing cell: <c ... r="ADDR" .../>
  const selfReStr = new RegExp(`<c([^>]*?)r="${addr}"([^>]*)/>`, 'i');
  if (selfReStr.test(sheetXml)) {
    return sheetXml.replace(selfReStr, (_m, pre, post) => {
      let attrs = `${pre || ''} r="${addr}" ${post || ''}`.replace(/\s+/g, ' ');
      // remove existing t attribute if any
      attrs = attrs.replace(/\s+t="[^"]*"/i, '');
      attrs = attrs + ' t="inlineStr"';
      return `<c${attrs}><is><t>${esc}</t></is></c>`;
    });
  }
  const cOpenRe = new RegExp(`<c([^>]*?)r="${addr}"([^>]*)>`, 'i');
  const cTagRe = new RegExp(`<c([^>]*?)r="${addr}"([^>]*)>([\s\S]*?)<\/c>`, 'i');
  if (!cTagRe.test(sheetXml)) {
    // Cell not found; leave as-is (template should have initial values)
    return sheetXml;
  }
  return sheetXml.replace(cTagRe, (_m, pre, post, inner) => {
    let attrs = `${pre || ''} r="${addr}" ${post || ''}`.replace(/\s+/g, ' ');
    // remove existing t attribute
    attrs = attrs.replace(/\s+t="[^"]*"/i, '');
    // ensure inlineStr
    attrs = attrs + ' t="inlineStr"';
    const prefix = `<c${attrs}>`;
    const newInner = `<is><t>${esc}</t></is>`;
    return `${prefix}${newInner}</c>`;
  });
}

function replaceCellNumber(sheetXml: string, addr: string, value: string): string {
  const num = normalizeNumber(value);
  if (num == null) return sheetXml; // invalid numeric; skip
  // Handle self-closing cell: <c ... r="ADDR" .../>
  const selfReNum = new RegExp(`<c([^>]*?)r="${addr}"([^>]*)/>`, 'i');
  if (selfReNum.test(sheetXml)) {
    return sheetXml.replace(selfReNum, (_m, pre, post) => {
      let attrs = `${pre || ''} r="${addr}" ${post || ''}`.replace(/\s+/g, ' ');
      // remove explicit type to keep numeric behavior
      attrs = attrs.replace(/\s+t="[^"]*"/i, '');
      return `<c${attrs}><v>${num}</v></c>`;
    });
  }
  const cTagRe = new RegExp(`<c([^>]*?)r="${addr}"([^>]*)>([\s\S]*?)<\/c>`, 'i');
  if (!cTagRe.test(sheetXml)) {
    return sheetXml;
  }
  return sheetXml.replace(cTagRe, (_m, pre, post, inner) => {
    let attrs = `${pre || ''} r="${addr}" ${post || ''}`.replace(/\s+/g, ' ');
    // remove t attribute (numeric cells often omit t)
    attrs = attrs.replace(/\s+t="[^"]*"/i, '');
    const prefix = `<c${attrs}>`;
    const newInner = `<v>${num}</v>`;
    return `${prefix}${newInner}</c>`;
  });
}

export async function updateCells(
  zip: ZipFiles,
  sheetPath: string,
  updates: Array<{ addr: string; value: string; type: 'string' | 'number' }>
): Promise<void> {
  let sheetXml = await getText(zip, sheetPath);
  for (const u of updates) {
    if (isBlank(u.value)) continue;
    if (u.type === 'number') sheetXml = replaceCellNumber(sheetXml, u.addr, u.value);
    else sheetXml = replaceCellString(sheetXml, u.addr, u.value);
  }
  setText(zip, sheetPath, sheetXml);
}

export async function packXlsx(zip: ZipFiles): Promise<Buffer> {
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buf as Buffer;
}

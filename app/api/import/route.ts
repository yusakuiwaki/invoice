import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ExtractedItem, ImportResponse, InvoiceData } from '@/app/types';

export const runtime = 'nodejs';

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

async function ensureDirs() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function defaultMockData(): InvoiceData {
  return {
    reporterName: '畠中 良太',
    currency: 'USD',
    amount: '797,488.67',
    payeeCountry: 'USA',
    payeeName: 'RAYONIER',
    productType: '直貿',
    productAmount: '797,488.67',
    withholdingTaxConfirmed: true,
    goodsDescription:
      'PULP Acetanier F LV, PULP R-HJ, PULP R-HJ 11S, PULP S-HJ, PULP A-F, PULP P-F, PULP C-F, PULP E-F',
    originCountry: 'USA',
    shippingPorts:
      'SAVANNAH, SAVANNAH, SAVANNAH, SAVANNAH, JACKSONVILLE, JACKSONVILLE, JACKSONVILLE, JACKSONVILLE',
    countryName: 'USA',
    notNKIran: true,
    notSanctioned: true,
  };
}

function validate(data: InvoiceData): string[] {
  const errors: string[] = [];
  if (!data.reporterName.trim()) errors.push('報告者氏名は必須です');
  if (!/^[A-Z]{3}$/.test(data.currency.trim())) errors.push('通貨は3文字の通貨コード');
  if (!/^[-0-9.,]+$/.test(data.amount.trim())) errors.push('金額は数値形式で入力');
  if (!data.payeeCountry.trim()) errors.push('支払先国は必須です');
  if (!data.payeeName.trim()) errors.push('支払先(会社名)は必須です');
  if (!/^[-0-9.,]+$/.test(data.productAmount.trim()))
    errors.push('金額(①商品代)は数値形式で入力');
  if (!data.goodsDescription.trim()) errors.push('輸入貨物名称は必須です');
  if (!data.originCountry.trim()) errors.push('原産地は必須です');
  if (!data.countryName.trim()) errors.push('国名は必須です');
  return errors;
}

export async function POST(req: Request) {
  await ensureDirs();
  const form = await req.formData();
  const files = form.getAll('files');
  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const items: ExtractedItem[] = [];
  for (const entry of files) {
    if (!(entry instanceof File)) continue;
    const file = entry as File;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 8);
    const safeName = `${Date.now()}_${hash}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const dest = path.join(UPLOAD_DIR, safeName);
    await writeFile(dest, buffer);
    console.log(`[import] saved: ${dest} (${buffer.length} bytes)`);

    // Create mock extracted data. Optionally tweak per filename.
    const base = defaultMockData();
    // Start with mock values, then clear the user-input-only fields to enforce manual entry
    const data: InvoiceData = {
      ...base,
      payeeName: base.payeeName || file.name.split('.')[0],
      reporterName: '',
      productType: '',
      withholdingTaxConfirmed: false,
      originCountry: '',
      shippingPorts: '',
      countryName: '',
      notNKIran: false,
      notSanctioned: false,
    };
    // Do not populate initial errors; validation will occur on user edits / export
    const errors: string[] = [];
    items.push({ id: hash, filename: file.name, data, errors });
  }

  const res: ImportResponse = { items };
  return NextResponse.json(res);
}


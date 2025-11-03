import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { loadXlsx, getSheetPathByName, updateCells, packXlsx, isBlank } from '@/app/lib/openxml';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const data = payload?.data as {
      reporterName: string;
      currency: string;
      amount: string;
      payeeCountry: string;
      payeeName: string;
      productType: string;
      productAmount: string;
      withholdingTaxConfirmed: boolean;
      goodsDescription: string;
      originCountry: string;
      shippingPorts: string;
      countryName: string;
      notNKIran: boolean;
      notSanctioned: boolean;
    };

    if (!data) {
      return NextResponse.json({ error: 'Missing JSON data' }, { status: 400 });
    }

    // Load fixed Excel template
    const templatePath = path.join(
      process.cwd(),
      'template',
      '外国送金に関わる報告書テンプレート.xlsx'
    );

    const fileBuf = await fs.readFile(templatePath);
    const zip = await loadXlsx(fileBuf);
    // Target the "テンプレート" sheet explicitly
    const sheetPath = await getSheetPathByName(zip, 'テンプレート');

    const updates: Array<{ addr: string; value: string; type: 'string' | 'number' }> = [];
    const pushStr = (addr: string, v?: string) => {
      if (isBlank(v)) return; // keep template default
      updates.push({ addr, value: String(v), type: 'string' });
    };
    const pushNum = (addr: string, v?: string) => {
      if (isBlank(v)) return;
      updates.push({ addr, value: String(v), type: 'number' });
    };

    // Mapping (write only when provided)
    pushStr('M5', data.reporterName); // MNOPQR:5 → M5
    pushStr('D7', data.currency); // DE7:DF7 → D7
    pushNum('G7', data.amount); // GHIJKLMNO:7 → G7
    pushStr('C8', data.payeeCountry); // CDEF:8 → C8
    pushStr('J8', data.payeeName); // JKLMNOPQR:8 → J8
    pushNum('O9', data.productAmount); // OP:9 → O9
    pushStr('F23', data.goodsDescription); // FGHIJKLMNOP:23 → F23
    pushStr('F25', data.originCountry); // FGHIJKLMNOP:25 → F25
    pushStr('E28', data.shippingPorts); // EFGH:28 → E28
    pushStr('O28', data.countryName); // OP28 → O28

    await updateCells(zip, sheetPath, updates);

    const buffer = await packXlsx(zip);
    const fileName = `report_${Date.now()}.xlsx`;
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('[export] error', err);
    return NextResponse.json({ error: 'Failed to generate Excel' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';

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

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.worksheets[0];

    // Helper to safely set cell value (if range is merged, writing to the first cell is sufficient)
    const set = (addr: string, value: string | number | boolean | null | undefined) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'string' && value.trim() === '') return; // keep template's initial value
      ws.getCell(addr).value = value as any;
    };

    // Map fields to template cells
    // Note: The provided notation like "MNOPQR:5" is interpreted as the first column of that span on the row.
    // If the template has merged cells for these ranges, writing to the first cell fills the merged area.
    set('M5', data.reporterName); // reporterName: MNOPQR:5 → M5

    // currency: DE7:DF7 → interpret as D7-F7 range, write to D7 (left-most)
    set('D7', data.currency);

    // amount: GHIJKLMNO:7 → G7
    set('G7', data.amount);

    // payeeCountry: CDEF:8 → C8
    set('C8', data.payeeCountry);

    // payeeName: JKLMNOPQR:8 → J8
    set('J8', data.payeeName);

    // productAmount: OP:9 → O9 (left aligned)
    set('O9', data.productAmount);
    ws.getCell('O9').alignment = { horizontal: 'left' };

    // goodsDescription: FGHIJKLMNOP:23 → F23
    set('F23', data.goodsDescription);

    // originCountry: FGHIJKLMNOP:25 → F25
    set('F25', data.originCountry);

    // shippingPorts: EFGH:28 → E28
    set('E28', data.shippingPorts);

    // countryName: OP28 → O28
    set('O28', data.countryName);

    const buffer = await wb.xlsx.writeBuffer();
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

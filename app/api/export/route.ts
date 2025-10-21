import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

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

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('報告書');

    ws.columns = [
      { header: '項目', key: 'label', width: 40 },
      { header: '値', key: 'value', width: 80 },
    ];

    const rows: Array<[string, string]> = [
      ['報告者氏名', data.reporterName],
      ['支払金額通貨', data.currency],
      ['金額', data.amount],
      ['支払先国', data.payeeCountry],
      ['支払先（会社名等）', data.payeeName],
      ['①商品代（a.直貿／b.間貿）', data.productType],
      ['金額（①商品代）', data.productAmount],
      ['人事グループへの確認（源泉所得税）', String(data.withholdingTaxConfirmed)],
      ['輸入貨物名称', data.goodsDescription],
      ['原産地', data.originCountry],
      ['船積地', data.shippingPorts],
      ['国名', data.countryName],
      ['北朝鮮/イラン関連ではない', String(data.notNKIran)],
      ['制裁対象との取引ではない', String(data.notSanctioned)],
    ];

    for (const [label, value] of rows) {
      ws.addRow({ label, value });
    }
    ws.getRow(1).font = { bold: true };
    ws.getColumn(1).alignment = { vertical: 'top' };
    ws.getColumn(2).alignment = { vertical: 'top' };
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

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


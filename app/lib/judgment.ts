export type JudgmentRule = {
  itemName: string; // 品目名（部分一致で検索）
  payeeCountry: string; // 支払先国
  payeeName: string; // 支払先（会社名等）
  originCountry: string; // 原産地
  shipCity: string; // 船積地（都市名）
  shipCountry: string; // 船積地（国名）
};

// 判断リスト（品目名 → 各項目の対応値）
export const JUDGMENT_RULES: JudgmentRule[] = [
  { itemName: 'AMELIANIER-F', payeeCountry: 'USA', payeeName: 'RAYONIER', originCountry: 'USA', shipCity: 'JACKSONVILLE', shipCountry: 'USA' },
  { itemName: 'PLACETATE-F', payeeCountry: 'USA', payeeName: 'RAYONIER', originCountry: 'USA', shipCity: 'JACKSONVILLE', shipCountry: 'USA' },
  { itemName: 'ACETANIER-F-LV', payeeCountry: 'USA', payeeName: 'RAYONIER', originCountry: 'USA', shipCity: 'SAVANNAH', shipCountry: 'USA' },
  { itemName: 'CELLUNIER-F', payeeCountry: 'USA', payeeName: 'RAYONIER', originCountry: 'USA', shipCity: 'SAVANNAH', shipCountry: 'USA' },
  { itemName: 'ETHENIER-F', payeeCountry: 'USA', payeeName: 'RAYONIER', originCountry: 'USA', shipCity: 'SAVANNAH', shipCountry: 'USA' },
  { itemName: 'RAYACETA-HJ', payeeCountry: 'USA', payeeName: 'RAYONIER', originCountry: 'USA', shipCity: 'SAVANNAH', shipCountry: 'USA' },
  { itemName: 'RAYACETA-HJ 11S', payeeCountry: 'USA', payeeName: 'RAYONIER', originCountry: 'USA', shipCity: 'SAVANNAH', shipCountry: 'USA' },
  { itemName: 'SULFATATE-HJ', payeeCountry: 'USA', payeeName: 'RAYONIER', originCountry: 'USA', shipCity: 'SAVANNAH', shipCountry: 'USA' },
  { itemName: 'SUPER ACETA', payeeCountry: 'ノルウェー', payeeName: 'BORREGAARD', originCountry: 'NORWAY', shipCity: 'ROTTERDAM', shipCountry: 'NETHERLANDS' },
  { itemName: 'Blue Bear MV', payeeCountry: 'ノルウェー', payeeName: 'BORREGAARD', originCountry: 'NORWAY', shipCity: 'ROTTERDAM', shipCountry: 'NETHERLANDS' },
  { itemName: 'LV-U', payeeCountry: 'ノルウェー', payeeName: 'BORREGAARD', originCountry: 'NORWAY', shipCity: 'ROTTERDAM', shipCountry: 'NETHERLANDS' },
  { itemName: 'Ultra Aceta', payeeCountry: 'ノルウェー', payeeName: 'BORREGAARD', originCountry: 'NORWAY', shipCity: 'OSLO', shipCountry: 'NORWAY' },
  { itemName: 'IARY', payeeCountry: '日本', payeeName: '三井物産パッケージング', originCountry: 'USA', shipCity: 'LOS ANGELES', shipCountry: 'USA' },
  { itemName: '225HL-M', payeeCountry: '日本', payeeName: '三井物産パッケージング', originCountry: 'USA', shipCity: 'LOS ANGELES', shipCountry: 'USA' },
  { itemName: 'HVE', payeeCountry: '日本', payeeName: '三井物産パッケージング', originCountry: 'USA', shipCity: 'LOS ANGELES', shipCountry: 'USA' },
  { itemName: 'AC1600', payeeCountry: '日本', payeeName: '東工ユーセン', originCountry: 'CHINA', shipCity: 'QINGDAO', shipCountry: 'CHINA' },
  { itemName: 'CP9125', payeeCountry: '日本', payeeName: '東工ユーセン', originCountry: 'CHINA', shipCity: 'QINGDAO', shipCountry: 'CHINA' },
  { itemName: 'PCS2400', payeeCountry: '日本', payeeName: '東工ユーセン', originCountry: 'CHINA', shipCity: 'QINGDAO', shipCountry: 'CHINA' },
  { itemName: 'DIAMOND', payeeCountry: '日本', payeeName: '丸紅', originCountry: 'THAILAND', shipCity: 'BANGKOK', shipCountry: 'THAILAND' },
  { itemName: 'BAHIA ACE', payeeCountry: '日本', payeeName: '丸紅', originCountry: 'BRAZIL', shipCity: 'SALVADOR', shipCountry: 'BRAZIL' },
];

function findMatches(text: string): JudgmentRule[] {
  const t = (text || '').toLowerCase();
  if (!t) return [];
  return JUDGMENT_RULES.filter((r) => t.includes(r.itemName.toLowerCase()));
}

export type AutofillResult = {
  // 補完後の値（空文字は補完なしと同じ扱い）
  payeeCountry?: string;
  payeeName?: string;
  originCountry?: string;
  shippingPorts?: string; // カンマ区切り（複数マッチ時はユニーク化）
  countryName?: string; // 船積地（国名）
};

// 入力された輸入貨物名称から判断リストを照合し、補完値を返す
export function getAutofillForGoodsDescription(goodsDescription: string): AutofillResult | null {
  const matches = findMatches(goodsDescription);
  if (matches.length === 0) return null;

  // 代表（最初に一致したルール）を採用
  const primary = matches[0];
  // 複数一致した場合は船積地（都市名）は重複排除して連結
  const cities = Array.from(new Set(matches.map((m) => m.shipCity))).join(', ');

  return {
    payeeCountry: primary.payeeCountry,
    payeeName: primary.payeeName,
    originCountry: primary.originCountry,
    shippingPorts: cities || primary.shipCity,
    countryName: primary.shipCountry,
  };
}


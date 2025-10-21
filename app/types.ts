export type InvoiceData = {
  reporterName: string;
  currency: string;
  amount: string; // keep as string for easy input
  payeeCountry: string;
  payeeName: string;
  productType: '直貿' | '間貿';
  productAmount: string;
  withholdingTaxConfirmed: boolean;
  goodsDescription: string;
  originCountry: string;
  shippingPorts: string; // CSV list
  countryName: string;
  notNKIran: boolean;
  notSanctioned: boolean;
};

export type ExtractedItem = {
  id: string;
  filename: string;
  data: InvoiceData;
  errors: string[];
};

export type ImportResponse = {
  items: ExtractedItem[];
};


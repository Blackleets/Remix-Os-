// Country profiles for commercial invoicing. These are NOT certified fiscal
// configurations — they preconfigure currency, locale, taxes and labels for
// the document. Real fiscal compliance (CFDI/SAT for Mexico, Verifactu for
// Spain, etc.) must be plugged in later via a fiscal provider integration.

import type { CountryProfileId } from './invoices';

export interface InvoiceCountryProfile {
  id: CountryProfileId;
  country: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  taxName: string;
  commonTaxRates: number[];
  defaultTaxRate: number;
  invoiceLabel: string;
  quoteLabel: string;
  receiptLabel: string;
  salesNoteLabel: string;
  taxIdLabel: string;
  warning: string;
  paperSize: 'a4' | 'letter';
}

export const INVOICE_COUNTRY_PROFILES: Record<CountryProfileId, InvoiceCountryProfile> = {
  ES: {
    id: 'ES',
    country: 'España',
    currency: 'EUR',
    currencySymbol: '€',
    locale: 'es-ES',
    taxName: 'IVA',
    commonTaxRates: [0, 4, 10, 21],
    defaultTaxRate: 21,
    invoiceLabel: 'Factura',
    quoteLabel: 'Presupuesto',
    receiptLabel: 'Recibo',
    salesNoteLabel: 'Nota de venta',
    taxIdLabel: 'NIF / CIF',
    warning:
      'Documento comercial. Verifactu y factura electrónica certificada requieren conectar un proveedor fiscal autorizado.',
    paperSize: 'a4',
  },
  MX: {
    id: 'MX',
    country: 'México',
    currency: 'MXN',
    currencySymbol: '$',
    locale: 'es-MX',
    taxName: 'IVA',
    commonTaxRates: [0, 8, 16],
    defaultTaxRate: 16,
    invoiceLabel: 'Factura',
    quoteLabel: 'Cotización',
    receiptLabel: 'Recibo',
    salesNoteLabel: 'Nota de venta',
    taxIdLabel: 'RFC',
    warning:
      'Documento comercial. El CFDI timbrado del SAT requiere integración con un PAC autorizado.',
    paperSize: 'letter',
  },
  US: {
    id: 'US',
    country: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    locale: 'en-US',
    taxName: 'Sales Tax',
    commonTaxRates: [0],
    defaultTaxRate: 0,
    invoiceLabel: 'Invoice',
    quoteLabel: 'Quote',
    receiptLabel: 'Receipt',
    salesNoteLabel: 'Sales note',
    taxIdLabel: 'Tax ID / EIN',
    warning:
      'Commercial invoice. Sales tax rules vary by state and locality; connect a tax provider for production.',
    paperSize: 'letter',
  },
  EU_GENERIC: {
    id: 'EU_GENERIC',
    country: 'European Union',
    currency: 'EUR',
    currencySymbol: '€',
    locale: 'en-GB',
    taxName: 'VAT',
    commonTaxRates: [0, 5, 10, 20, 21, 23],
    defaultTaxRate: 21,
    invoiceLabel: 'Invoice',
    quoteLabel: 'Quote',
    receiptLabel: 'Receipt',
    salesNoteLabel: 'Sales note',
    taxIdLabel: 'VAT ID',
    warning:
      'Commercial invoice. VAT and e-invoicing rules differ per EU member state; plug in a fiscal provider when required.',
    paperSize: 'a4',
  },
  LATAM_GENERIC: {
    id: 'LATAM_GENERIC',
    country: 'LATAM',
    currency: 'USD',
    currencySymbol: '$',
    locale: 'es-419',
    taxName: 'IVA',
    commonTaxRates: [0, 12, 13, 15, 16, 18, 19, 21],
    defaultTaxRate: 19,
    invoiceLabel: 'Factura',
    quoteLabel: 'Cotización',
    receiptLabel: 'Recibo',
    salesNoteLabel: 'Nota de venta',
    taxIdLabel: 'Identificación fiscal',
    warning:
      'Factura comercial. El cumplimiento fiscal local requiere un proveedor autorizado por país.',
    paperSize: 'letter',
  },
};

export const COUNTRY_PROFILE_ORDER: CountryProfileId[] = [
  'ES',
  'MX',
  'US',
  'EU_GENERIC',
  'LATAM_GENERIC',
];

export function getCountryProfile(id?: CountryProfileId | string | null): InvoiceCountryProfile {
  if (id && id in INVOICE_COUNTRY_PROFILES) {
    return INVOICE_COUNTRY_PROFILES[id as CountryProfileId];
  }
  return INVOICE_COUNTRY_PROFILES.ES;
}

export function formatInvoiceCurrency(value: number, profile: InvoiceCountryProfile): string {
  try {
    return new Intl.NumberFormat(profile.locale, {
      style: 'currency',
      currency: profile.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${profile.currencySymbol}${value.toFixed(2)}`;
  }
}

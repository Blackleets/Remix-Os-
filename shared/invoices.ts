// Pure invoicing logic. Used by client (services/forms/UI) and server-side
// helpers. No Firestore / framework imports — keep it deterministic and testable.

export type InvoiceType = 'invoice' | 'quote' | 'receipt' | 'sales_note';

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export type CountryProfileId =
  | 'ES'
  | 'MX'
  | 'US'
  | 'EU_GENERIC'
  | 'LATAM_GENERIC';

export type ComplianceMode =
  | 'commercial_only'
  | 'provider_pending'
  | 'certified';

export type FiscalProvider =
  | 'none'
  | 'stripe_tax'
  | 'sat_pac'
  | 'verifactu_provider'
  | 'local_provider';

export type FiscalStatus =
  | 'not_required'
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'rejected';

export interface InvoiceItemInput {
  id?: string;
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  taxRate?: number;
  taxName?: string;
}

export interface InvoiceItemCalc extends InvoiceItemInput {
  id: string;
  subtotal: number;
  discountAmount: number;
  taxBase: number;
  taxTotal: number;
  total: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

// Money helpers — keep two-decimal precision and avoid the classic
// 0.1 + 0.2 floating-point drift by going through integer cents.
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

export function calculateInvoiceItem(input: InvoiceItemInput): InvoiceItemCalc {
  const quantity = Math.max(0, safeNumber(input.quantity));
  const unitPrice = Math.max(0, safeNumber(input.unitPrice));
  const discountRate = Math.min(1, Math.max(0, safeNumber(input.discountRate)));
  const taxRate = Math.max(0, safeNumber(input.taxRate)) / 100;

  const subtotal = roundMoney(quantity * unitPrice);
  const discountAmount = roundMoney(subtotal * discountRate);
  const taxBase = roundMoney(subtotal - discountAmount);
  const taxTotal = roundMoney(taxBase * taxRate);
  const total = roundMoney(taxBase + taxTotal);

  return {
    ...input,
    id: input.id || cryptoRandomId(),
    quantity,
    unitPrice,
    discountRate,
    taxRate: safeNumber(input.taxRate),
    subtotal,
    discountAmount,
    taxBase,
    taxTotal,
    total,
  };
}

export function calculateInvoiceTotals(items: InvoiceItemInput[]): {
  items: InvoiceItemCalc[];
  totals: InvoiceTotals;
} {
  const computed = items.map(calculateInvoiceItem);
  const totals = computed.reduce<InvoiceTotals>(
    (acc, item) => ({
      subtotal: roundMoney(acc.subtotal + item.subtotal),
      discountTotal: roundMoney(acc.discountTotal + item.discountAmount),
      taxTotal: roundMoney(acc.taxTotal + item.taxTotal),
      total: roundMoney(acc.total + item.total),
    }),
    { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }
  );

  return { items: computed, totals };
}

export function formatInvoiceNumber(series: string, sequentialNumber: number, pad = 4): string {
  const cleanSeries = (series || 'A').toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  const padded = String(Math.max(0, Math.floor(sequentialNumber))).padStart(pad, '0');
  return `${cleanSeries}-${padded}`;
}

// Once a document is issued/paid/cancelled, only payment/state transitions
// and notes should change — never line items or fiscal core fields.
export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === 'draft';
}

export function canDeleteInvoice(status: InvoiceStatus): boolean {
  return status === 'draft';
}

export function isFinalStatus(status: InvoiceStatus): boolean {
  return status === 'paid' || status === 'cancelled';
}

export function nextStatus(current: InvoiceStatus, target: InvoiceStatus): InvoiceStatus | null {
  const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    draft: ['issued', 'cancelled'],
    issued: ['sent', 'paid', 'overdue', 'cancelled'],
    sent: ['paid', 'overdue', 'cancelled'],
    paid: [],
    overdue: ['paid', 'cancelled'],
    cancelled: [],
  };
  return validTransitions[current]?.includes(target) ? target : null;
}

function cryptoRandomId(): string {
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.randomUUID) {
    return (globalThis as any).crypto.randomUUID();
  }
  return `inv_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

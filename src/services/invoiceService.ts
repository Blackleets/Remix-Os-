import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  runTransaction,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Invoice,
  InvoiceLineItem,
} from '../types/invoice';
import {
  calculateInvoiceTotals,
  canDeleteInvoice as canDeleteByStatus,
  formatInvoiceNumber,
  isInvoiceEditable,
  type ComplianceMode,
  type CountryProfileId,
  type InvoiceItemInput,
  type InvoiceStatus,
  type InvoiceType,
} from '../../shared/invoices';
import { getCountryProfile } from '../../shared/invoiceProfiles';

const INVOICES_COLLECTION = 'invoices';
const COUNTERS_COLLECTION = 'invoiceCounters';

export interface InvoiceDraftInput {
  companyId: string;
  type: InvoiceType;
  series?: string;
  countryProfile: CountryProfileId;

  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerTaxId?: string;
  customerAddress?: string;
  customerCountry?: string;

  issuerName: string;
  issuerTaxId?: string;
  issuerAddress?: string;
  issuerCountry?: string;

  issueDate: Date;
  dueDate?: Date | null;

  items: InvoiceItemInput[];

  notes?: string;
  terms?: string;

  orderId?: string;
  createdBy: string;

  complianceMode?: ComplianceMode;
}

function counterId(companyId: string, series: string): string {
  return `${companyId}_${(series || 'A').toUpperCase()}`;
}

function buildInvoicePayload(input: InvoiceDraftInput, status: InvoiceStatus): {
  payload: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'invoiceNumber' | 'sequentialNumber'> & {
    invoiceNumber: string;
    sequentialNumber: number;
  };
  items: InvoiceLineItem[];
  totals: ReturnType<typeof calculateInvoiceTotals>['totals'];
} {
  const profile = getCountryProfile(input.countryProfile);
  const computed = calculateInvoiceTotals(input.items || []);
  const items: InvoiceLineItem[] = computed.items.map((it) => ({
    id: it.id,
    productId: it.productId,
    name: it.name,
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountRate: it.discountRate ?? 0,
    taxRate: it.taxRate ?? 0,
    taxName: it.taxName || profile.taxName,
    subtotal: it.subtotal,
    taxTotal: it.taxTotal,
    total: it.total,
  }));

  const payload = {
    companyId: input.companyId,
    type: input.type,
    status,
    invoiceNumber: '',
    series: (input.series || 'A').toUpperCase(),
    sequentialNumber: 0,
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerTaxId: input.customerTaxId,
    customerAddress: input.customerAddress,
    customerCountry: input.customerCountry,
    issuerName: input.issuerName,
    issuerTaxId: input.issuerTaxId,
    issuerAddress: input.issuerAddress,
    issuerCountry: input.issuerCountry,
    currency: profile.currency,
    locale: profile.locale,
    countryProfile: input.countryProfile,
    issueDate: Timestamp.fromDate(input.issueDate),
    dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
    items,
    subtotal: computed.totals.subtotal,
    discountTotal: computed.totals.discountTotal,
    taxTotal: computed.totals.taxTotal,
    total: computed.totals.total,
    amountPaid: 0,
    amountDue: computed.totals.total,
    notes: input.notes,
    terms: input.terms,
    orderId: input.orderId,
    complianceMode: input.complianceMode || 'commercial_only',
    fiscalProvider: 'none' as const,
    fiscalStatus: 'not_required' as const,
    createdBy: input.createdBy,
  };

  return { payload: payload as any, items, totals: computed.totals };
}

// Save a draft invoice. No sequential number assigned yet — the document
// stays editable until explicitly issued.
export async function saveInvoiceDraft(input: InvoiceDraftInput): Promise<string> {
  const newRef = doc(collection(db, INVOICES_COLLECTION));
  const { payload } = buildInvoicePayload(input, 'draft');

  await setDoc(newRef, {
    ...stripUndefined(payload),
    invoiceNumber: '',
    sequentialNumber: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return newRef.id;
}

export async function updateInvoiceDraft(invoiceId: string, input: InvoiceDraftInput): Promise<void> {
  const ref = doc(db, INVOICES_COLLECTION, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Factura no encontrada');
  const existing = snap.data() as Invoice;
  if (!isInvoiceEditable(existing.status)) {
    throw new Error('Esta factura ya fue emitida y no puede editarse.');
  }
  const { payload } = buildInvoicePayload(input, existing.status);
  await updateDoc(ref, {
    ...stripUndefined(payload),
    invoiceNumber: existing.invoiceNumber,
    sequentialNumber: existing.sequentialNumber,
    updatedAt: serverTimestamp(),
  } as any);
}

// Issue a draft → assign a sequential number atomically using a Firestore
// transaction on invoiceCounters/{companyId}_{series}. This keeps numbering
// monotonic even with concurrent issuers in the same company.
export async function issueInvoice(invoiceId: string): Promise<{ invoiceNumber: string; sequentialNumber: number }> {
  return await runTransaction(db, async (tx) => {
    const invRef = doc(db, INVOICES_COLLECTION, invoiceId);
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists()) throw new Error('Factura no encontrada');
    const invoice = invSnap.data() as Invoice;
    if (invoice.status !== 'draft') {
      throw new Error('Solo borradores pueden emitirse.');
    }

    const ctrRef = doc(db, COUNTERS_COLLECTION, counterId(invoice.companyId, invoice.series));
    const ctrSnap = await tx.get(ctrRef);
    const current = ctrSnap.exists() ? Number(ctrSnap.data().nextNumber || 1) : 1;

    const invoiceNumber = formatInvoiceNumber(invoice.series, current);

    tx.set(ctrRef, {
      companyId: invoice.companyId,
      series: invoice.series,
      nextNumber: current + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    tx.update(invRef, {
      status: 'issued',
      invoiceNumber,
      sequentialNumber: current,
      updatedAt: serverTimestamp(),
    });

    return { invoiceNumber, sequentialNumber: current };
  });
}

export async function markInvoicePaid(invoiceId: string, amountPaid?: number): Promise<void> {
  const ref = doc(db, INVOICES_COLLECTION, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Factura no encontrada');
  const invoice = snap.data() as Invoice;
  const paid = typeof amountPaid === 'number' ? amountPaid : invoice.total;
  await updateDoc(ref, {
    status: 'paid',
    amountPaid: paid,
    amountDue: Math.max(0, invoice.total - paid),
    updatedAt: serverTimestamp(),
  });
}

export async function markInvoiceSent(invoiceId: string): Promise<void> {
  const ref = doc(db, INVOICES_COLLECTION, invoiceId);
  await updateDoc(ref, { status: 'sent', updatedAt: serverTimestamp() });
}

export async function cancelInvoice(invoiceId: string): Promise<void> {
  const ref = doc(db, INVOICES_COLLECTION, invoiceId);
  await updateDoc(ref, { status: 'cancelled', updatedAt: serverTimestamp() });
}

export async function deleteInvoiceDraft(invoiceId: string): Promise<void> {
  const ref = doc(db, INVOICES_COLLECTION, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const invoice = snap.data() as Invoice;
  if (!canDeleteByStatus(invoice.status)) {
    throw new Error('Solo borradores pueden eliminarse.');
  }
  await deleteDoc(ref);
}

// Live list of invoices for the current company, newest first.
export function subscribeInvoices(
  companyId: string,
  callback: (invoices: Invoice[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, INVOICES_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: Invoice[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, 'id'>) }));
      callback(items);
    },
    (error) => {
      console.error('Invoice subscription error:', error);
      onError?.(error);
    }
  );
}

export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const ref = doc(db, INVOICES_COLLECTION, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Invoice, 'id'>) };
}

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as Partial<T>;
}

export { isInvoiceEditable, canDeleteByStatus };

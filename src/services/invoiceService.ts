import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type {
  Invoice,
  InvoiceLineItem,
} from '../types/invoice';
import {
  calculateInvoiceTotals,
  canDeleteInvoice as canDeleteByStatus,
  isInvoiceEditable,
  type ComplianceMode,
  type CountryProfileId,
  type InvoiceItemInput,
  type InvoiceStatus,
  type InvoiceType,
} from '../../shared/invoices';
import { getCountryProfile } from '../../shared/invoiceProfiles';

const INVOICES_COLLECTION = 'invoices';

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

function normalizeOptionalText(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeRequiredText(value: string | undefined | null, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function sanitizeFirestoreValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => sanitizeFirestoreValue(entry)) as T;
  }
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    const isPlainObject = proto === Object.prototype || proto === null;
    if (!isPlainObject) return value;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        result[key] = sanitizeFirestoreValue(entry);
      }
    }
    return result as T;
  }
  return value;
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
    productId: normalizeOptionalText(it.productId),
    name: normalizeRequiredText(it.name),
    description: normalizeOptionalText(it.description),
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountRate: it.discountRate ?? 0,
    taxRate: it.taxRate ?? 0,
    taxName: normalizeOptionalText(it.taxName) || profile.taxName,
    subtotal: it.subtotal,
    taxTotal: it.taxTotal,
    total: it.total,
  }));

  const payload = {
    companyId: normalizeRequiredText(input.companyId),
    type: input.type,
    status,
    invoiceNumber: '',
    series: normalizeRequiredText(input.series, 'A').toUpperCase(),
    sequentialNumber: 0,
    customerId: normalizeOptionalText(input.customerId),
    customerName: normalizeRequiredText(input.customerName),
    customerEmail: normalizeOptionalText(input.customerEmail),
    customerTaxId: normalizeOptionalText(input.customerTaxId),
    customerAddress: normalizeOptionalText(input.customerAddress),
    customerCountry: normalizeOptionalText(input.customerCountry),
    issuerName: normalizeRequiredText(input.issuerName),
    issuerTaxId: normalizeOptionalText(input.issuerTaxId),
    issuerAddress: normalizeOptionalText(input.issuerAddress),
    issuerCountry: normalizeOptionalText(input.issuerCountry),
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
    notes: normalizeOptionalText(input.notes),
    terms: normalizeOptionalText(input.terms),
    orderId: normalizeOptionalText(input.orderId),
    complianceMode: input.complianceMode || 'commercial_only',
    fiscalProvider: 'none' as const,
    fiscalStatus: 'not_required' as const,
    createdBy: normalizeRequiredText(input.createdBy),
  };

  return { payload: sanitizeFirestoreValue(payload) as any, items, totals: computed.totals };
}

// Save a draft invoice. No sequential number assigned yet — the document
// stays editable until explicitly issued.
export async function saveInvoiceDraft(input: InvoiceDraftInput): Promise<string> {
  const newRef = doc(collection(db, INVOICES_COLLECTION));
  const { payload } = buildInvoicePayload(input, 'draft');

  await setDoc(newRef, {
    ...payload,
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
  if (existing.companyId !== input.companyId) {
    throw new Error('Esta factura no pertenece a tu empresa.');
  }
  if (!isInvoiceEditable(existing.status)) {
    throw new Error('Esta factura ya fue emitida y no puede editarse.');
  }
  const { payload } = buildInvoicePayload(input, existing.status);
  await updateDoc(ref, {
    ...payload,
    invoiceNumber: existing.invoiceNumber,
    sequentialNumber: existing.sequentialNumber,
    updatedAt: serverTimestamp(),
  } as any);
}

// Issue a draft → the sequential number is ALWAYS assigned server-side by
// POST /api/invoices/issue (firebase-admin transaction on
// invoiceCounters/{companyId}_{series}). There is intentionally NO
// client-side numbering fallback: legal invoice numbering must be
// authoritative and tamper-proof, so if the backend is unreachable we fail
// loudly instead of minting a number the client could manipulate or
// duplicate. The caller surfaces the thrown message to the user.
export async function issueInvoice(invoiceId: string): Promise<{ invoiceNumber: string; sequentialNumber: number }> {
  const invRef = doc(db, INVOICES_COLLECTION, invoiceId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) throw new Error('Factura no encontrada');
  const invoice = invSnap.data() as Invoice;
  if (invoice.status !== 'draft') {
    throw new Error('Solo borradores pueden emitirse.');
  }

  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) {
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión para emitir la factura.');
  }

  let response: Response;
  try {
    response = await fetch('/api/invoices/issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ companyId: invoice.companyId, invoiceId }),
    });
  } catch {
    // Network/CORS failure — do NOT fall back to client numbering.
    throw new Error(
      'No se pudo contactar el servidor para emitir la factura. Revisa tu conexión e inténtalo de nuevo.'
    );
  }

  if (response.status === 404 || response.status === 405) {
    throw new Error(
      'El servicio de emisión de facturas no está disponible en este despliegue. Contacta a soporte antes de emitir.'
    );
  }

  if (!response.ok) {
    let message = `No se pudo emitir la factura (error ${response.status}).`;
    try {
      const body = await response.json();
      if (body?.error) message = String(body.error);
    } catch {
      /* keep generic message */
    }
    throw new Error(message);
  }

  const payload = await response.json().catch(() => null);
  const invoiceNumber = payload && typeof payload.invoiceNumber === 'string' ? payload.invoiceNumber : '';
  const sequentialNumber = payload && typeof payload.sequentialNumber === 'number' ? payload.sequentialNumber : 0;
  if (!invoiceNumber) {
    throw new Error('El servidor no devolvió un número de factura válido. Inténtalo de nuevo.');
  }
  return { invoiceNumber, sequentialNumber };
}

// Reads the invoice and validates ownership before any mutation, so the user
// gets a clear Spanish message instead of a raw Firestore
// "Missing or insufficient permissions". `companyId` is optional for backward
// compatibility but every call site passes it.
async function loadOwnedInvoice(invoiceId: string, companyId?: string): Promise<{ ref: ReturnType<typeof doc>; invoice: Invoice }> {
  const ref = doc(db, INVOICES_COLLECTION, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Factura no encontrada');
  const invoice = snap.data() as Invoice;
  if (companyId && invoice.companyId !== companyId) {
    throw new Error('Esta factura no pertenece a tu empresa.');
  }
  return { ref, invoice };
}

export async function markInvoicePaid(
  invoiceId: string,
  companyId?: string,
  amountPaid?: number
): Promise<void> {
  const { ref, invoice } = await loadOwnedInvoice(invoiceId, companyId);
  if (invoice.status !== 'issued' && invoice.status !== 'sent' && invoice.status !== 'overdue') {
    throw new Error('Solo facturas emitidas, enviadas o vencidas pueden marcarse como pagadas.');
  }
  const paid = typeof amountPaid === 'number' ? amountPaid : invoice.total;
  await updateDoc(ref, {
    status: 'paid',
    amountPaid: paid,
    amountDue: Math.max(0, invoice.total - paid),
    updatedAt: serverTimestamp(),
  });
}

export async function markInvoiceSent(invoiceId: string, companyId?: string): Promise<void> {
  const { ref, invoice } = await loadOwnedInvoice(invoiceId, companyId);
  if (invoice.status !== 'issued') {
    throw new Error('Solo facturas emitidas pueden marcarse como enviadas.');
  }
  await updateDoc(ref, { status: 'sent', updatedAt: serverTimestamp() });
}

export async function cancelInvoice(invoiceId: string, companyId?: string): Promise<void> {
  const { ref, invoice } = await loadOwnedInvoice(invoiceId, companyId);
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    throw new Error('Una factura pagada o ya cancelada no puede cancelarse.');
  }
  await updateDoc(ref, { status: 'cancelled', updatedAt: serverTimestamp() });
}

// Clone an existing invoice as a fresh draft — useful for recurring billing
// or re-issuing a corrected version. The new document gets:
// - a fresh id, status="draft", empty invoiceNumber/sequentialNumber so the
//   counter is only spent when the draft is explicitly issued.
// - issueDate set to today; dueDate is dropped so the operator re-confirms it.
// - payment fields reset (amountPaid=0, amountDue=total).
// - orderId stripped to avoid linking two invoices to the same order.
export async function duplicateInvoice(invoiceId: string, createdBy: string, companyId?: string): Promise<string> {
  const sourceRef = doc(db, INVOICES_COLLECTION, invoiceId);
  const snap = await getDoc(sourceRef);
  if (!snap.exists()) throw new Error('Factura no encontrada');
  const source = snap.data() as Invoice;
  if (companyId && source.companyId !== companyId) {
    throw new Error('Esta factura no pertenece a tu empresa.');
  }

  const newRef = doc(collection(db, INVOICES_COLLECTION));
  const cloneItems: InvoiceLineItem[] = (source.items || []).map((it) => ({
    ...it,
    id: typeof globalThis !== 'undefined' && (globalThis as any).crypto?.randomUUID
      ? (globalThis as any).crypto.randomUUID()
      : `inv_${Math.random().toString(36).slice(2, 10)}`,
  }));

  await setDoc(newRef, sanitizeFirestoreValue({
    companyId: source.companyId,
    type: source.type,
    status: 'draft' as const,
    invoiceNumber: '',
    series: source.series,
    sequentialNumber: 0,
    customerId: source.customerId,
    customerName: source.customerName,
    customerEmail: source.customerEmail,
    customerTaxId: source.customerTaxId,
    customerAddress: source.customerAddress,
    customerCountry: source.customerCountry,
    issuerName: source.issuerName,
    issuerTaxId: source.issuerTaxId,
    issuerAddress: source.issuerAddress,
    issuerCountry: source.issuerCountry,
    currency: source.currency,
    locale: source.locale,
    countryProfile: source.countryProfile,
    issueDate: Timestamp.fromDate(new Date()),
    dueDate: null,
    items: cloneItems,
    subtotal: source.subtotal,
    discountTotal: source.discountTotal,
    taxTotal: source.taxTotal,
    total: source.total,
    amountPaid: 0,
    amountDue: source.total,
    notes: source.notes,
    terms: source.terms,
    complianceMode: source.complianceMode || 'commercial_only',
    fiscalProvider: 'none' as const,
    fiscalStatus: 'not_required' as const,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }) as any);

  return newRef.id;
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

export { isInvoiceEditable, canDeleteByStatus };

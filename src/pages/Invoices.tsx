import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Receipt,
  Plus,
  Download,
  Trash2,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  limit,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, OSGlyph, cn } from '../components/Common';
import { EmptyStatePanel } from '../components/EmptyStatePanel';
import { InvoiceForm, type InvoiceFormValues } from '../components/invoices/InvoiceForm';
import type { InvoiceItemInput } from '../../shared/invoices';
import { InvoiceStatusBadge, invoiceStatusLabel } from '../components/invoices/InvoiceStatusBadge';
import {
  cancelInvoice,
  deleteInvoiceDraft,
  issueInvoice,
  markInvoicePaid,
  markInvoiceSent,
  saveInvoiceDraft,
  subscribeInvoices,
  updateInvoiceDraft,
} from '../services/invoiceService';
import { downloadInvoicePdf } from '../services/invoicePdfService';
import type { Invoice } from '../types/invoice';
import type { InvoiceStatus, InvoiceType } from '../../shared/invoices';
import { formatInvoiceCurrency, getCountryProfile } from '../../shared/invoiceProfiles';

type StatusFilter = 'all' | InvoiceStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'draft', label: 'Borrador' },
  { value: 'issued', label: 'Emitidas' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'paid', label: 'Pagadas' },
  { value: 'overdue', label: 'Vencidas' },
  { value: 'cancelled', label: 'Canceladas' },
];

interface CustomerLite {
  id: string;
  name: string;
  email?: string;
  taxId?: string;
  address?: string;
  country?: string;
}

interface ProductLite {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface OrderPrefill {
  orderId: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerTaxId?: string;
  customerAddress?: string;
  customerCountry?: string;
  items: InvoiceItemInput[];
}

export function Invoices() {
  const { user, company, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [defaultType, setDefaultType] = useState<InvoiceType>('invoice');
  const [prefill, setPrefill] = useState<OrderPrefill | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const canManage = role === 'owner' || role === 'admin' || role === 'staff';

  // Accept "Crear factura desde pedido" deep links from Orders. We consume
  // the navigation state once, then strip it so a back/refresh doesn't
  // reopen the form unexpectedly.
  useEffect(() => {
    const fromOrder = (location.state as { fromOrder?: OrderPrefill } | null)?.fromOrder;
    if (!fromOrder) return;
    setPrefill(fromOrder);
    setEditing(null);
    setDefaultType('invoice');
    setFormOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    const unsubscribe = subscribeInvoices(
      company.id,
      (items) => {
        setInvoices(items);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, [company]);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    (async () => {
      try {
        const [customersSnap, productsSnap] = await Promise.all([
          getDocs(query(collection(db, 'customers'), where('companyId', '==', company.id), limit(200))),
          getDocs(query(collection(db, 'products'), where('companyId', '==', company.id), limit(200))),
        ]);
        if (cancelled) return;
        setCustomers(
          customersSnap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              name: data.name || 'Sin nombre',
              email: data.email,
              taxId: data.taxId || data.rfc || data.nif,
              address: data.address,
              country: data.country,
            };
          })
        );
        setProducts(
          productsSnap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              name: data.name || 'Producto',
              price: typeof data.price === 'number' ? data.price : 0,
              description: data.description,
            };
          })
        );
      } catch (err) {
        console.error('Failed to preload customers/products for invoices:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [company]);

  const visible = useMemo(() => {
    if (filter === 'all') return invoices;
    return invoices.filter((inv) => inv.status === filter);
  }, [filter, invoices]);

  const counts = useMemo(() => {
    const map: Record<StatusFilter, number> = {
      all: invoices.length,
      draft: 0,
      issued: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
    };
    invoices.forEach((inv) => {
      map[inv.status] = (map[inv.status] || 0) + 1;
    });
    return map;
  }, [invoices]);

  const openNew = (type: InvoiceType) => {
    setEditing(null);
    setDefaultType(type);
    setFormOpen(true);
  };

  const openEdit = (invoice: Invoice) => {
    setEditing(invoice);
    setDefaultType(invoice.type);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setPrefill(null);
  };

  const buildDraftInput = (values: InvoiceFormValues) => ({
    companyId: company!.id,
    type: values.type,
    series: values.series,
    countryProfile: values.countryProfile,
    customerId: values.customerId,
    customerName: values.customerName,
    customerEmail: values.customerEmail,
    customerTaxId: values.customerTaxId,
    customerAddress: values.customerAddress,
    customerCountry: values.customerCountry,
    issuerName: values.issuerName,
    issuerTaxId: values.issuerTaxId,
    issuerAddress: values.issuerAddress,
    issuerCountry: values.issuerCountry,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    items: values.items,
    notes: values.notes,
    terms: values.terms,
    orderId: values.orderId,
    createdBy: user!.uid,
    complianceMode: 'commercial_only' as const,
  });

  const handleSaveDraft = async (values: InvoiceFormValues, id?: string) => {
    if (!company || !user) return;
    setSaving(true);
    setActionError(null);
    try {
      const input = buildDraftInput(values);
      if (id) {
        await updateInvoiceDraft(id, input);
      } else {
        await saveInvoiceDraft(input);
      }
      closeForm();
    } catch (err: any) {
      setActionError(err?.message || 'No se pudo guardar el borrador.');
    } finally {
      setSaving(false);
    }
  };

  const handleIssue = async (values: InvoiceFormValues, id?: string) => {
    if (!company || !user) return;
    setSaving(true);
    setActionError(null);
    try {
      const input = buildDraftInput(values);
      let invoiceId = id;
      if (!invoiceId) {
        invoiceId = await saveInvoiceDraft(input);
      } else {
        await updateInvoiceDraft(invoiceId, input);
      }
      await issueInvoice(invoiceId);
      closeForm();
    } catch (err: any) {
      setActionError(err?.message || 'No se pudo emitir el documento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = (invoice: Invoice) => {
    try {
      downloadInvoicePdf(invoice, {
        name: invoice.issuerName,
        taxId: invoice.issuerTaxId,
        address: invoice.issuerAddress,
      });
    } catch (err) {
      console.error('Failed to download invoice PDF:', err);
      setActionError('No se pudo generar el PDF.');
    }
  };

  const runAction = async (invoice: Invoice, action: () => Promise<void>) => {
    setActionBusyId(invoice.id);
    setActionError(null);
    try {
      await action();
    } catch (err: any) {
      setActionError(err?.message || 'Acción fallida.');
    } finally {
      setActionBusyId(null);
    }
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center py-32">
        <Card className="text-center">
          <p className="text-sm text-neutral-400">Selecciona una empresa para gestionar facturas.</p>
        </Card>
      </div>
    );
  }

  const totalEmitted = invoices
    .filter((inv) => inv.status !== 'draft' && inv.status !== 'cancelled')
    .reduce((acc, inv) => acc + inv.total, 0);
  const totalPending = invoices
    .filter((inv) => inv.status === 'issued' || inv.status === 'sent' || inv.status === 'overdue')
    .reduce((acc, inv) => acc + inv.amountDue, 0);

  const headerProfile = getCountryProfile(invoices[0]?.countryProfile || 'ES');

  const defaultIssuer = {
    name: company.name,
    taxId: (company as any).taxId,
    address: (company as any).address,
    country: company.country,
  };

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="hero-gradient rounded-[32px] border border-white/10 p-6 md:p-8"
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker mb-3">Facturación</p>
            <h1 className="section-title text-3xl md:text-4xl">Facturas</h1>
            <p className="mt-3 max-w-2xl text-sm text-neutral-400 md:text-base">
              Crea facturas, presupuestos y recibos profesionales para España, México, USA, Europa y LATAM.
              Documento comercial — la certificación fiscal local se conectará luego con proveedores autorizados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <>
                <Button onClick={() => openNew('invoice')} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva factura
                </Button>
                <Button onClick={() => openNew('quote')} variant="secondary" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Nuevo presupuesto
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <KpiTile
            label="Emitido"
            value={formatInvoiceCurrency(totalEmitted, headerProfile)}
            hint={`${invoices.length} documentos`}
          />
          <KpiTile
            label="Pendiente"
            value={formatInvoiceCurrency(totalPending, headerProfile)}
            hint="Por cobrar"
            tone="amber"
          />
          <KpiTile
            label="Pagadas"
            value={String(counts.paid)}
            hint="En el periodo"
            tone="emerald"
          />
        </div>
      </motion.section>

      {actionError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
          {actionError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
              filter === opt.value
                ? 'border-blue-400/30 bg-blue-500/[0.12] text-blue-100'
                : 'border-white/10 bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:text-white'
            )}
          >
            {opt.label}
            <span className="ml-2 font-mono text-[10px] text-neutral-500">{counts[opt.value]}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center px-6 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
            <span className="ml-3 text-sm text-neutral-400">Cargando facturas…</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-4 py-16 sm:px-6">
            <EmptyStatePanel
              eyebrow="Facturación"
              title="Tus facturas aparecerán aquí."
              description="Crea facturas, presupuestos y recibos profesionales conectados a clientes, productos y pedidos."
              icon={<Receipt className="h-7 w-7" />}
              primaryActionLabel={canManage ? 'Crear factura' : undefined}
              onPrimaryAction={canManage ? () => openNew('invoice') : undefined}
              secondaryActionLabel={canManage ? 'Crear presupuesto' : undefined}
              onSecondaryAction={canManage ? () => openNew('quote') : undefined}
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-neutral-400">
              No hay documentos en estado <span className="text-white">{invoiceStatusLabel(filter as InvoiceStatus)}</span>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Número</th>
                  <th className="table-header">Tipo</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header">Estado</th>
                  <th className="table-header">Emisión</th>
                  <th className="table-header">Vencimiento</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header text-right">Pendiente</th>
                  <th className="table-header">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((inv) => {
                  const profile = getCountryProfile(inv.countryProfile);
                  return (
                    <tr
                      key={inv.id}
                      className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="table-cell">
                        <button
                          onClick={() => openEdit(inv)}
                          className="text-left font-mono text-sm font-semibold text-white hover:text-blue-200"
                        >
                          {inv.invoiceNumber || 'Borrador'}
                        </button>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-600">
                          {inv.series}
                        </p>
                      </td>
                      <td className="table-cell text-sm text-neutral-300">
                        {labelForType(inv.type, profile)}
                      </td>
                      <td className="table-cell text-sm text-neutral-300">
                        <p className="text-white">{inv.customerName}</p>
                        {inv.customerTaxId && (
                          <p className="mt-1 font-mono text-[10px] text-neutral-500">{inv.customerTaxId}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="table-cell text-xs text-neutral-400">{formatShortDate(inv.issueDate)}</td>
                      <td className="table-cell text-xs text-neutral-400">
                        {inv.dueDate ? formatShortDate(inv.dueDate) : '—'}
                      </td>
                      <td className="table-cell text-right font-mono text-sm text-white">
                        {formatInvoiceCurrency(inv.total, profile)}
                      </td>
                      <td className="table-cell text-right font-mono text-sm text-amber-200">
                        {formatInvoiceCurrency(inv.amountDue, profile)}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <RowAction
                            title="Descargar PDF"
                            onClick={() => handleDownloadPdf(inv)}
                            icon={<Download className="h-3.5 w-3.5" />}
                          />
                          {canManage && inv.status === 'issued' && (
                            <RowAction
                              title="Marcar como enviada"
                              onClick={() => runAction(inv, () => markInvoiceSent(inv.id))}
                              busy={actionBusyId === inv.id}
                              icon={<Send className="h-3.5 w-3.5" />}
                            />
                          )}
                          {canManage && (inv.status === 'issued' || inv.status === 'sent' || inv.status === 'overdue') && (
                            <RowAction
                              title="Marcar pagada"
                              onClick={() => runAction(inv, () => markInvoicePaid(inv.id))}
                              busy={actionBusyId === inv.id}
                              tone="emerald"
                              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            />
                          )}
                          {canManage && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <RowAction
                              title="Cancelar"
                              onClick={() => runAction(inv, () => cancelInvoice(inv.id))}
                              busy={actionBusyId === inv.id}
                              tone="amber"
                              icon={<XCircle className="h-3.5 w-3.5" />}
                            />
                          )}
                          {canManage && inv.status === 'draft' && (
                            <RowAction
                              title="Eliminar borrador"
                              onClick={() => runAction(inv, () => deleteInvoiceDraft(inv.id))}
                              busy={actionBusyId === inv.id}
                              tone="red"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <InvoiceForm
        open={formOpen}
        onClose={closeForm}
        customers={customers}
        products={products}
        defaultIssuer={defaultIssuer}
        existing={editing}
        initial={
          editing
            ? {
                type: editing.type,
                series: editing.series,
                countryProfile: editing.countryProfile,
                customerId: editing.customerId,
                customerName: editing.customerName,
                customerEmail: editing.customerEmail,
                customerTaxId: editing.customerTaxId,
                customerAddress: editing.customerAddress,
                customerCountry: editing.customerCountry,
                issuerName: editing.issuerName,
                issuerTaxId: editing.issuerTaxId,
                issuerAddress: editing.issuerAddress,
                issuerCountry: editing.issuerCountry,
                issueDate: toDateLike(editing.issueDate),
                dueDate: editing.dueDate ? toDateLike(editing.dueDate) : null,
                items: editing.items.map((it) => ({
                  id: it.id,
                  productId: it.productId,
                  name: it.name,
                  description: it.description,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  discountRate: it.discountRate,
                  taxRate: it.taxRate,
                  taxName: it.taxName,
                })),
                notes: editing.notes,
                terms: editing.terms,
                orderId: editing.orderId,
              }
            : prefill
              ? {
                  type: defaultType,
                  countryProfile: 'ES',
                  customerId: prefill.customerId,
                  customerName: prefill.customerName || '',
                  customerEmail: prefill.customerEmail,
                  customerTaxId: prefill.customerTaxId,
                  customerAddress: prefill.customerAddress,
                  customerCountry: prefill.customerCountry,
                  orderId: prefill.orderId,
                  items: prefill.items,
                }
              : { type: defaultType, countryProfile: 'ES' }
        }
        saving={saving}
        readOnly={!!editing && editing.status !== 'draft'}
        onSaveDraft={handleSaveDraft}
        onIssue={handleIssue}
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'amber' | 'emerald';
}) {
  const toneClass = {
    amber: 'border-amber-400/16 from-amber-500/10',
    emerald: 'border-emerald-400/16 from-emerald-500/10',
  }[tone as 'amber' | 'emerald'] || 'border-blue-400/14 from-blue-500/10';

  return (
    <div className={cn('relative overflow-hidden rounded-[24px] border bg-[rgba(9,12,18,0.94)] p-5', toneClass.split(' ')[0])}>
      <div className={cn('absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent opacity-80', toneClass.split(' ')[1])} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</p>
          <p className="mt-2 font-mono text-2xl font-bold text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
        </div>
        <OSGlyph tone={tone === 'emerald' ? 'emerald' : tone === 'amber' ? 'amber' : 'blue'} size="md">
          <Receipt className="h-4.5 w-4.5" />
        </OSGlyph>
      </div>
    </div>
  );
}

function RowAction({
  title,
  onClick,
  icon,
  busy,
  tone,
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  busy?: boolean;
  tone?: 'emerald' | 'amber' | 'red';
}) {
  const toneClass = {
    emerald: 'hover:border-emerald-400/30 hover:text-emerald-200',
    amber: 'hover:border-amber-400/30 hover:text-amber-200',
    red: 'hover:border-red-400/30 hover:text-red-200',
  }[tone as 'emerald' | 'amber' | 'red'] || 'hover:border-blue-400/30 hover:text-blue-200';

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!!busy}
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.03] p-2 text-neutral-400 transition-colors disabled:opacity-50',
        toneClass
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
    </button>
  );
}

function labelForType(type: InvoiceType, profile: ReturnType<typeof getCountryProfile>): string {
  if (type === 'quote') return profile.quoteLabel;
  if (type === 'receipt') return profile.receiptLabel;
  if (type === 'sales_note') return profile.salesNoteLabel;
  return profile.invoiceLabel;
}

function toDateLike(value: any): Date {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatShortDate(value: any): string {
  const date = toDateLike(value);
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

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
  Copy,
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
  duplicateInvoice,
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

interface POSQuotePrefill {
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerTaxId?: string;
  customerAddress?: string;
  customerCountry?: string;
  items: InvoiceItemInput[];
  dueDate?: Date | null;
  terms?: string;
  notes?: string;
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
  const [posQuotePrefill, setPosQuotePrefill] = useState<POSQuotePrefill | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const canManage = role === 'owner' || role === 'admin' || role === 'staff';

  // Accept "Crear factura desde pedido" deep links from Orders. We consume
  // the navigation state once, then strip it so a back/refresh doesn't
  // reopen the form unexpectedly.
  useEffect(() => {
    const state = location.state as { fromOrder?: OrderPrefill; fromPosQuote?: POSQuotePrefill } | null;
    const fromOrder = state?.fromOrder;
    const fromPosQuote = state?.fromPosQuote;
    if (!fromOrder && !fromPosQuote) return;
    setPrefill(fromOrder || null);
    setPosQuotePrefill(
      fromPosQuote
        ? {
            ...fromPosQuote,
            dueDate: fromPosQuote.dueDate || suggestDueDateFromTerms(fromPosQuote.terms),
          }
        : null
    );
    setEditing(null);
    setDefaultType(fromPosQuote ? 'quote' : 'invoice');
    if (fromPosQuote) {
      setFormOpen(true);
      navigate(location.pathname, {
        replace: true,
        state: null,
      });
      return;
    }
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
    setPrefill(null);
    setPosQuotePrefill(null);
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
    setPosQuotePrefill(null);
  };

  const openQuoteAsInvoice = (invoice: Invoice) => {
    setEditing(null);
    setPrefill(null);
    setPosQuotePrefill({
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerTaxId: invoice.customerTaxId,
      customerAddress: invoice.customerAddress,
      customerCountry: invoice.customerCountry,
      dueDate: suggestDueDateFromTerms(invoice.terms, toDateLike(invoice.issueDate)),
      terms: invoice.terms,
      notes: invoice.notes ? `Convertido desde presupuesto.\n${invoice.notes}` : 'Convertido desde presupuesto.',
      items: (invoice.items || []).map((it) => ({
        productId: it.productId,
        name: it.name,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountRate: it.discountRate ?? 0,
        taxRate: it.taxRate ?? 0,
        taxName: it.taxName,
      })),
    });
    setDefaultType('invoice');
    setFormOpen(true);
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

  const handleDuplicate = async (invoice: Invoice) => {
    if (!user) return;
    setActionBusyId(invoice.id);
    setActionError(null);
    try {
      await duplicateInvoice(invoice.id, user.uid);
    } catch (err: any) {
      setActionError(err?.message || 'No se pudo duplicar la factura.');
    } finally {
      setActionBusyId(null);
    }
  };

  const runAction = async (invoice: Invoice, action: () => Promise<void>) => {
    setActionBusyId(invoice.id);
    setActionError(null);
    try {
      await action();
    } catch (err: any) {
      setActionError(err?.message || 'Accion fallida.');
    } finally {
      setActionBusyId(null);
    }
  };

  // Shared by the desktop table and the mobile card list so behaviour stays
  // identical across breakpoints.
  const renderActions = (inv: Invoice) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <RowAction
        title="Descargar PDF"
        onClick={() => handleDownloadPdf(inv)}
        icon={<Download className="h-3.5 w-3.5" />}
      />
      {canManage && inv.type === 'quote' && inv.status !== 'cancelled' && (
        <RowAction
          title="Convertir en factura"
          onClick={() => openQuoteAsInvoice(inv)}
          icon={<Receipt className="h-3.5 w-3.5" />}
        />
      )}
      {canManage && (
        <RowAction
          title="Duplicar como nuevo borrador"
          onClick={() => handleDuplicate(inv)}
          busy={actionBusyId === inv.id}
          icon={<Copy className="h-3.5 w-3.5" />}
        />
      )}
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
  );

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
            <p className="section-kicker mb-3">Facturacion</p>
            <h1 className="section-title text-3xl md:text-4xl">Facturas</h1>
            <p className="mt-3 max-w-2xl text-sm text-neutral-400 md:text-base">
              Crea facturas, presupuestos y recibos profesionales para Espana, Mexico, USA, Europa y LATAM.
              Documento comercial. La certificacion fiscal local se conectara luego con proveedores autorizados.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-400/20 bg-blue-500/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                PDF beta activo
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-300">
                Factura, presupuesto y recibo
              </span>
            </div>
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
                <Button onClick={() => openNew('receipt')} variant="secondary" className="gap-2">
                  <Receipt className="h-4 w-4" />
                  Nuevo recibo
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

      <Card className="border-white/10 bg-white/[0.025] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Modo beta</p>
            <p className="mt-2 text-sm text-neutral-300">
              Ya puedes crear borradores, emitir documentos comerciales y descargar PDF para validar flujo operativo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-neutral-400">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Borradores editables</span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">PDF descargable</span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Desde pedidos</span>
          </div>
        </div>
      </Card>

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
            <span className="ml-3 text-sm text-neutral-400">Cargando facturas...</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-4 py-16 sm:px-6">
            <EmptyStatePanel
              eyebrow="Facturacion"
              title="Tus facturas apareceran aqui."
              description="Crea facturas, presupuestos y recibos conectados a clientes, productos y pedidos."
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
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-4 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-300 transition-colors hover:border-white/20 hover:text-white"
            >
              Ver todo
            </button>
          </div>
        ) : (
          <>
            {/* Desktop: full table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="table-header">Numero</th>
                    <th className="table-header">Tipo</th>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header">Emision</th>
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
                            type="button"
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
                          {inv.dueDate ? formatShortDate(inv.dueDate) : '-'}
                        </td>
                        <td className="table-cell text-right font-mono text-sm text-white">
                          {formatInvoiceCurrency(inv.total, profile)}
                        </td>
                        <td className="table-cell text-right font-mono text-sm text-amber-200">
                          {formatInvoiceCurrency(inv.amountDue, profile)}
                        </td>
                        <td className="table-cell">{renderActions(inv)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: tap-friendly cards */}
            <div className="divide-y divide-white/[0.05] sm:hidden">
              {visible.map((inv) => {
                const profile = getCountryProfile(inv.countryProfile);
                return (
                  <div key={inv.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(inv)}
                        className="min-w-0 text-left"
                      >
                        <p className="truncate font-mono text-sm font-semibold text-white">
                          {inv.invoiceNumber || 'Borrador'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-neutral-400">
                          {labelForType(inv.type, profile)} / {inv.customerName}
                        </p>
                      </button>
                      <InvoiceStatusBadge status={inv.status} />
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                        <p>{formatShortDate(inv.issueDate)}</p>
                        {inv.dueDate && <p className="mt-0.5 text-neutral-600">Vence {formatShortDate(inv.dueDate)}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-base font-bold text-white">
                          {formatInvoiceCurrency(inv.total, profile)}
                        </p>
                        {inv.amountDue > 0 && inv.status !== 'cancelled' && (
                          <p className="mt-0.5 font-mono text-[11px] text-amber-200">
                            Pend. {formatInvoiceCurrency(inv.amountDue, profile)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/[0.05] pt-3">{renderActions(inv)}</div>
                  </div>
                );
              })}
            </div>
          </>
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
              : posQuotePrefill
                ? {
                    type: defaultType,
                    countryProfile: 'ES',
                    customerId: posQuotePrefill.customerId,
                    customerName: posQuotePrefill.customerName || '',
                    customerEmail: posQuotePrefill.customerEmail,
                    customerTaxId: posQuotePrefill.customerTaxId,
                    customerAddress: posQuotePrefill.customerAddress,
                    customerCountry: posQuotePrefill.customerCountry,
                    dueDate: posQuotePrefill.dueDate || null,
                    items: posQuotePrefill.items || [],
                    terms: posQuotePrefill.terms,
                    notes: posQuotePrefill.notes,
                  }
              : { type: defaultType, countryProfile: 'ES' }
        }
        saving={saving}
        readOnly={!!editing && editing.status !== 'draft'}
        error={formOpen ? actionError : null}
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

function suggestDueDateFromTerms(terms?: string, baseDate?: Date | null): Date | null {
  if (!terms) return null;
  const normalized = terms.toLowerCase();
  const explicitDays = normalized.match(/(\d+)\s*d[ií]as?/);
  const start = baseDate && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date();
  if (explicitDays) {
    const days = Number(explicitDays[1]);
    if (!Number.isFinite(days) || days < 0) return null;
    const due = new Date(start);
    due.setDate(due.getDate() + days);
    return due;
  }
  if (
    normalized.includes('contra entrega') ||
    normalized.includes('prepago') ||
    normalized.includes('contado')
  ) {
    return start;
  }
  return null;
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

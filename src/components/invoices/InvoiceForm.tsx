import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, X, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input, Label, cn } from '../Common';
import { InvoiceTotalsPanel } from './InvoiceTotals';
import {
  COUNTRY_PROFILE_ORDER,
  INVOICE_COUNTRY_PROFILES,
  getCountryProfile,
} from '../../../shared/invoiceProfiles';
import {
  calculateInvoiceTotals,
  type CountryProfileId,
  type InvoiceItemInput,
  type InvoiceType,
} from '../../../shared/invoices';
import type { Invoice } from '../../types/invoice';

interface CustomerOption {
  id: string;
  name: string;
  email?: string;
  taxId?: string;
  address?: string;
  country?: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface InvoiceFormValues {
  type: InvoiceType;
  series: string;
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
}

interface InvoiceFormProps {
  open: boolean;
  initial?: Partial<InvoiceFormValues> & { id?: string };
  customers: CustomerOption[];
  products: ProductOption[];
  defaultIssuer: {
    name: string;
    taxId?: string;
    address?: string;
    country?: string;
  };
  onClose: () => void;
  onSaveDraft: (values: InvoiceFormValues, id?: string) => Promise<void>;
  onIssue: (values: InvoiceFormValues, id?: string) => Promise<void>;
  saving?: boolean;
  readOnly?: boolean;
  existing?: Invoice | null;
}

function emptyItem(): InvoiceItemInput {
  return {
    name: '',
    quantity: 1,
    unitPrice: 0,
    discountRate: 0,
    taxRate: 0,
  };
}

export function InvoiceForm({
  open,
  initial,
  customers,
  products,
  defaultIssuer,
  onClose,
  onSaveDraft,
  onIssue,
  saving,
  readOnly,
  existing,
}: InvoiceFormProps) {
  const [type, setType] = useState<InvoiceType>(initial?.type || 'invoice');
  const [series, setSeries] = useState(initial?.series || 'A');
  const [countryProfile, setCountryProfile] = useState<CountryProfileId>(initial?.countryProfile || 'ES');
  const [customerId, setCustomerId] = useState<string | undefined>(initial?.customerId);
  const [customerName, setCustomerName] = useState(initial?.customerName || '');
  const [customerEmail, setCustomerEmail] = useState(initial?.customerEmail || '');
  const [customerTaxId, setCustomerTaxId] = useState(initial?.customerTaxId || '');
  const [customerAddress, setCustomerAddress] = useState(initial?.customerAddress || '');
  const [customerCountry, setCustomerCountry] = useState(initial?.customerCountry || '');
  const [issueDate, setIssueDate] = useState<string>(
    (initial?.issueDate ? toInputDate(initial.issueDate) : toInputDate(new Date()))
  );
  const [dueDate, setDueDate] = useState<string>(initial?.dueDate ? toInputDate(initial.dueDate) : '');
  const [items, setItems] = useState<InvoiceItemInput[]>(initial?.items?.length ? initial.items : [emptyItem()]);
  const [notes, setNotes] = useState(initial?.notes || '');
  const [terms, setTerms] = useState(initial?.terms || '');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type || 'invoice');
    setSeries(initial?.series || 'A');
    setCountryProfile(initial?.countryProfile || 'ES');
    setCustomerId(initial?.customerId);
    setCustomerName(initial?.customerName || '');
    setCustomerEmail(initial?.customerEmail || '');
    setCustomerTaxId(initial?.customerTaxId || '');
    setCustomerAddress(initial?.customerAddress || '');
    setCustomerCountry(initial?.customerCountry || '');
    setIssueDate(initial?.issueDate ? toInputDate(initial.issueDate) : toInputDate(new Date()));
    setDueDate(initial?.dueDate ? toInputDate(initial.dueDate) : '');
    setItems(initial?.items?.length ? initial.items : [emptyItem()]);
    setNotes(initial?.notes || '');
    setTerms(initial?.terms || '');
    setFormError(null);
  }, [open, initial]);

  const profile = useMemo(() => getCountryProfile(countryProfile), [countryProfile]);
  const { totals } = useMemo(() => calculateInvoiceTotals(items), [items]);

  const updateItem = (index: number, patch: Partial<InvoiceItemInput>) => {
    setItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const handleSelectCustomer = (id: string) => {
    const found = customers.find((c) => c.id === id);
    if (!found) {
      setCustomerId(undefined);
      return;
    }
    setCustomerId(found.id);
    setCustomerName(found.name);
    setCustomerEmail(found.email || '');
    setCustomerTaxId(found.taxId || '');
    setCustomerAddress(found.address || '');
    setCustomerCountry(found.country || '');
  };

  const handleAddProductLine = (productId: string) => {
    const found = products.find((p) => p.id === productId);
    if (!found) return;
    setItems((prev) => {
      const existingLine = prev.find((it) => !it.name && !it.unitPrice);
      const newItem: InvoiceItemInput = {
        productId: found.id,
        name: found.name,
        description: found.description,
        quantity: 1,
        unitPrice: found.price,
        discountRate: 0,
        taxRate: profile.defaultTaxRate,
      };
      if (existingLine) {
        return prev.map((it) => (it === existingLine ? newItem : it));
      }
      return [...prev, newItem];
    });
  };

  const validate = (): InvoiceFormValues | null => {
    if (!customerName.trim()) {
      setFormError('Indica el nombre del cliente.');
      return null;
    }
    if (items.length === 0) {
      setFormError('Añade al menos un concepto.');
      return null;
    }
    if (items.every((it) => !it.name.trim())) {
      setFormError('Cada línea debe tener un nombre.');
      return null;
    }
    if (totals.total < 0) {
      setFormError('El total no puede ser negativo.');
      return null;
    }
    const issue = new Date(issueDate);
    if (Number.isNaN(issue.getTime())) {
      setFormError('Fecha de emisión inválida.');
      return null;
    }
    let due: Date | null = null;
    if (dueDate) {
      due = new Date(dueDate);
      if (Number.isNaN(due.getTime())) {
        setFormError('Fecha de vencimiento inválida.');
        return null;
      }
    }
    setFormError(null);

    const filledItems = items
      .filter((it) => it.name.trim())
      .map((it) => ({
        ...it,
        discountRate: it.discountRate || 0,
        taxRate: it.taxRate || 0,
      }));

    return {
      type,
      series,
      countryProfile,
      customerId,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || undefined,
      customerTaxId: customerTaxId.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerCountry: customerCountry.trim() || undefined,
      issuerName: defaultIssuer.name,
      issuerTaxId: defaultIssuer.taxId,
      issuerAddress: defaultIssuer.address,
      issuerCountry: defaultIssuer.country,
      issueDate: issue,
      dueDate: due,
      items: filledItems,
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
    };
  };

  const handleSaveDraft = async () => {
    const values = validate();
    if (!values) return;
    await onSaveDraft(values, existing?.id);
  };

  const handleIssue = async () => {
    const values = validate();
    if (!values) return;
    await onIssue(values, existing?.id);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 my-3 w-full max-w-5xl rounded-[20px] border border-white/10 bg-[rgba(8,10,16,0.96)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.55)] sm:my-6 sm:rounded-[28px] sm:p-6 md:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Facturación</p>
            <h2 className="mt-2 text-xl font-bold text-white md:text-2xl">
              {existing ? `Editar ${profile.invoiceLabel.toLowerCase()}` : `Nueva ${profile.invoiceLabel.toLowerCase()}`}
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              {profile.country} · {profile.currency} · {profile.taxName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-neutral-400 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p>{profile.warning}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Tipo de documento</Label>
                <select
                  aria-label="Tipo de documento"
                  value={type}
                  onChange={(e) => setType(e.target.value as InvoiceType)}
                  disabled={readOnly}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white focus:border-blue-400/40 focus:outline-none"
                >
                  <option value="invoice" className="bg-neutral-950">{profile.invoiceLabel}</option>
                  <option value="quote" className="bg-neutral-950">{profile.quoteLabel}</option>
                  <option value="receipt" className="bg-neutral-950">{profile.receiptLabel}</option>
                  <option value="sales_note" className="bg-neutral-950">{profile.salesNoteLabel}</option>
                </select>
              </div>

              <div>
                <Label>Perfil de país</Label>
                <select
                  aria-label="Perfil de país"
                  value={countryProfile}
                  onChange={(e) => setCountryProfile(e.target.value as CountryProfileId)}
                  disabled={readOnly}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white focus:border-blue-400/40 focus:outline-none"
                >
                  {COUNTRY_PROFILE_ORDER.map((id) => (
                    <option key={id} value={id} className="bg-neutral-950">
                      {INVOICE_COUNTRY_PROFILES[id].country} · {INVOICE_COUNTRY_PROFILES[id].currency}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Serie</Label>
                <Input
                  value={series}
                  onChange={(e) => setSeries(e.target.value.toUpperCase())}
                  disabled={readOnly}
                  maxLength={8}
                />
              </div>

              <div>
                <Label>Fecha de emisión</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  disabled={readOnly}
                />
              </div>

              <div>
                <Label>Vencimiento (opcional)</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Cliente</p>
                {customers.length > 0 && (
                  <select
                    aria-label="Seleccionar cliente existente"
                    value={customerId || ''}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    disabled={readOnly}
                    className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white focus:border-blue-400/40 focus:outline-none"
                  >
                    <option value="" className="bg-neutral-950">Seleccionar cliente…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-neutral-950">{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Nombre</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={readOnly} />
                </div>
                <div>
                  <Label>{profile.taxIdLabel}</Label>
                  <Input value={customerTaxId} onChange={(e) => setCustomerTaxId(e.target.value)} disabled={readOnly} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} disabled={readOnly} />
                </div>
                <div>
                  <Label>País</Label>
                  <Input value={customerCountry} onChange={(e) => setCustomerCountry(e.target.value)} disabled={readOnly} />
                </div>
                <div className="md:col-span-2">
                  <Label>Dirección</Label>
                  <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} disabled={readOnly} />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Conceptos</p>
                {products.length > 0 && !readOnly && (
                  <select
                    aria-label="Añadir producto del catálogo"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddProductLine(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white focus:border-blue-400/40 focus:outline-none"
                  >
                    <option value="" className="bg-neutral-950">Añadir producto…</option>
                    {products.slice(0, 200).map((p) => (
                      <option key={p.id} value={p.id} className="bg-neutral-950">
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 md:grid-cols-[2fr_repeat(4,minmax(0,1fr))_auto] md:items-center"
                  >
                    <div className="col-span-2 md:col-span-1">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600 md:hidden">Concepto</span>
                      <Input
                        placeholder="Concepto"
                        value={item.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600 md:hidden">Cant.</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="Cant."
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600 md:hidden">Precio</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="Precio"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600 md:hidden">Dto %</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="Dto %"
                        value={(item.discountRate || 0) * 100 || ''}
                        onChange={(e) =>
                          updateItem(idx, {
                            discountRate: Math.min(1, Math.max(0, (parseFloat(e.target.value) || 0) / 100)),
                          })
                        }
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600 md:hidden">{profile.taxName}</span>
                      <select
                        aria-label={`Impuesto ${profile.taxName} para la línea ${idx + 1}`}
                        value={item.taxRate ?? 0}
                        onChange={(e) => updateItem(idx, { taxRate: parseFloat(e.target.value) || 0 })}
                        disabled={readOnly}
                        className="h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-sm text-white focus:border-blue-400/40 focus:outline-none"
                      >
                        {profile.commonTaxRates.map((rate) => (
                          <option key={rate} value={rate} className="bg-neutral-950">
                            {profile.taxName} {rate}%
                          </option>
                        ))}
                      </select>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className={cn(
                          'col-span-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-red-300 md:col-span-1 md:gap-0 md:text-[0px]',
                          items.length === 1 && 'pointer-events-none opacity-40'
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="md:hidden">Quitar línea</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={addItem}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400 transition-colors hover:border-blue-400/30 hover:text-blue-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir línea
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Notas</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={readOnly}
                  placeholder="Notas internas o mensaje al cliente."
                  className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-all focus:border-blue-400/40 focus:outline-none"
                />
              </div>
              <div>
                <Label>Términos</Label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  disabled={readOnly}
                  placeholder="Condiciones de pago, plazo, garantía…"
                  className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-all focus:border-blue-400/40 focus:outline-none"
                />
              </div>
            </div>

            {formError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
                {formError}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <InvoiceTotalsPanel
              countryProfile={countryProfile}
              subtotal={totals.subtotal}
              discountTotal={totals.discountTotal}
              taxTotal={totals.taxTotal}
              total={totals.total}
            />

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs text-neutral-400">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Emisor</p>
              <p className="mt-2 font-semibold text-white">{defaultIssuer.name}</p>
              {defaultIssuer.taxId && <p className="mt-1">{defaultIssuer.taxId}</p>}
              {defaultIssuer.address && <p className="mt-1">{defaultIssuer.address}</p>}
              {defaultIssuer.country && <p className="mt-1">{defaultIssuer.country}</p>}
            </div>

            {!readOnly && (
              <div className="space-y-2">
                <Button onClick={handleSaveDraft} disabled={!!saving} variant="secondary" className="w-full gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar borrador
                </Button>
                <Button onClick={handleIssue} disabled={!!saving} className="w-full gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Emitir {profile.invoiceLabel.toLowerCase()}
                </Button>
                <p className="text-center text-[10px] text-neutral-600">
                  Al emitir se asigna un número definitivo y se bloquea la edición.
                </p>
              </div>
            )}
          </aside>
        </div>
      </motion.div>
    </div>
  );
}

function toInputDate(value: any): string {
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (value && typeof value.toDate === 'function') date = value.toDate();
  else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

import { cn } from '../Common';
import { formatInvoiceCurrency, getCountryProfile } from '../../../shared/invoiceProfiles';
import type { CountryProfileId } from '../../../shared/invoices';

interface InvoiceTotalsProps {
  countryProfile: CountryProfileId;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  className?: string;
}

export function InvoiceTotalsPanel({
  countryProfile,
  subtotal,
  discountTotal,
  taxTotal,
  total,
  amountPaid,
  amountDue,
  className,
}: InvoiceTotalsProps) {
  const profile = getCountryProfile(countryProfile);
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/[0.025] p-5', className)}>
      <div className="space-y-2 text-sm">
        <Row label="Subtotal" value={formatInvoiceCurrency(subtotal, profile)} />
        {discountTotal > 0 && (
          <Row label="Descuento" value={`-${formatInvoiceCurrency(discountTotal, profile)}`} tone="amber" />
        )}
        <Row label={profile.taxName} value={formatInvoiceCurrency(taxTotal, profile)} />
        <div className="my-3 h-px bg-white/[0.06]" />
        <Row
          label="Total"
          value={formatInvoiceCurrency(total, profile)}
          emphasis
        />
        {typeof amountPaid === 'number' && amountPaid > 0 && (
          <Row label="Pagado" value={formatInvoiceCurrency(amountPaid, profile)} tone="emerald" />
        )}
        {typeof amountDue === 'number' && amountDue !== total && (
          <Row label="Pendiente" value={formatInvoiceCurrency(amountDue, profile)} tone="blue" />
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'amber' | 'emerald' | 'blue';
}) {
  const toneClass = {
    amber: 'text-amber-200',
    emerald: 'text-emerald-200',
    blue: 'text-blue-200',
  }[tone as 'amber' | 'emerald' | 'blue'] || '';
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={cn(
          'text-xs font-semibold uppercase tracking-[0.18em]',
          emphasis ? 'text-white' : 'text-neutral-500',
          toneClass
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'font-mono',
          emphasis ? 'text-xl font-bold text-white' : 'text-sm text-neutral-200',
          toneClass
        )}
      >
        {value}
      </span>
    </div>
  );
}

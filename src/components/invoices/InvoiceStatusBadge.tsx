import { cn } from '../Common';
import type { InvoiceStatus } from '../../../shared/invoices';

const STATUS_META: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: {
    label: 'Borrador',
    className: 'border-white/10 bg-white/[0.04] text-neutral-300',
  },
  issued: {
    label: 'Emitida',
    className: 'border-blue-400/20 bg-blue-500/[0.10] text-blue-200',
  },
  sent: {
    label: 'Enviada',
    className: 'border-violet-400/20 bg-violet-500/[0.10] text-violet-200',
  },
  paid: {
    label: 'Pagada',
    className: 'border-emerald-400/20 bg-emerald-500/[0.10] text-emerald-200',
  },
  overdue: {
    label: 'Vencida',
    className: 'border-amber-400/20 bg-amber-500/[0.10] text-amber-200',
  },
  cancelled: {
    label: 'Cancelada',
    className: 'border-red-400/20 bg-red-500/[0.10] text-red-200',
  },
};

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return STATUS_META[status]?.label || status;
}

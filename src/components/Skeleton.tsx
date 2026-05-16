import { cn } from './Common';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-white/[0.05]',
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-2xl border border-white/6 bg-white/[0.02] p-5', className)}>
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr>
      <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
      <td className="py-3 px-4"><Skeleton className="h-4 w-40" /></td>
      <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
      <td className="py-3 px-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
      <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
    </tr>
  );
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.02] p-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function SkeletonProductGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
          <Skeleton className="mb-4 h-32 w-full rounded-xl" />
          <Skeleton className="mb-2 h-4 w-3/4" />
          <Skeleton className="mb-3 h-3 w-1/2" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCustomerTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/6">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/6 bg-white/[0.02]">
            {['Cliente', 'Email', 'Segmento', 'RFM', 'Pedidos'].map(h => (
              <th key={h} className="py-3 px-4 text-left">
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonOrderList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

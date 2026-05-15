import { AlertTriangle, Filter, Loader2, MessageSquareText, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchPlatformFeedback,
  type PlatformFeedbackItem,
  type PlatformFeedbackSeverity,
  type PlatformFeedbackStatus,
  updatePlatformFeedback,
} from '../../services/companyApi';
import { Button, Card, Input, Label, cn } from '../Common';

type FilterStatus = 'all' | PlatformFeedbackStatus;
type FilterSeverity = 'all' | PlatformFeedbackSeverity;

function toDate(value?: string | number | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function SuperAdminFeedbackCenter() {
  const [items, setItems] = useState<PlatformFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<PlatformFeedbackItem | null>(null);
  const [statusDraft, setStatusDraft] = useState<PlatformFeedbackStatus>('open');
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadFeedback = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchPlatformFeedback({
          status: statusFilter,
          severity: severityFilter,
        });
        if (!isMounted) return;
        setItems((payload.feedback || []) as PlatformFeedbackItem[]);
      } catch (loadError) {
        console.error('Failed to load platform feedback:', loadError);
        if (isMounted) {
          setError('No se pudo cargar el Feedback Center.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadFeedback();

    return () => {
      isMounted = false;
    };
  }, [reloadKey, statusFilter, severityFilter]);

  useEffect(() => {
    if (!selectedItem) return;
    setStatusDraft(selectedItem.status);
    setNotesDraft(selectedItem.adminNotes || '');
  }, [selectedItem]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.message,
        item.userEmail,
        item.companyName || '',
        item.companyId,
      ].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, search]);

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlatformFeedback(selectedItem.id, {
        status: statusDraft,
        adminNotes: notesDraft,
      });

      setItems((current) =>
        current.map((item) =>
          item.id === selectedItem.id
            ? {
                ...item,
                status: statusDraft,
                adminNotes: notesDraft,
                updatedAt: new Date().toISOString(),
                reviewedAt: statusDraft === 'reviewed' ? new Date().toISOString() : item.reviewedAt,
                resolvedAt: statusDraft === 'resolved' ? new Date().toISOString() : item.resolvedAt,
              }
            : item
        )
      );

      setSelectedItem((current) => current ? {
        ...current,
        status: statusDraft,
        adminNotes: notesDraft,
        updatedAt: new Date().toISOString(),
        reviewedAt: statusDraft === 'reviewed' ? new Date().toISOString() : current.reviewedAt,
        resolvedAt: statusDraft === 'resolved' ? new Date().toISOString() : current.resolvedAt,
      } : null);
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      console.error('Failed to update platform feedback:', saveError);
      setError('No se pudo guardar el feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-3">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker text-neutral-500">Feedback Center</p>
            <h2 className="mt-2 text-lg font-bold text-white">Beta Feedback</h2>
          </div>
          <div className="telemetry-chip !px-3 !py-2">
            <MessageSquareText className="h-4 w-4" />
            <span>{items.length} items</span>
          </div>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_0.4fr_0.4fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título, mensaje, usuario o empresa"
              className="pl-11"
            />
          </div>
          <select
            aria-label="Filtrar feedback por estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
          >
            <option value="all" className="bg-neutral-950 text-white">Status: all</option>
            <option value="open" className="bg-neutral-950 text-white">open</option>
            <option value="reviewed" className="bg-neutral-950 text-white">reviewed</option>
            <option value="resolved" className="bg-neutral-950 text-white">resolved</option>
          </select>
          <select
            aria-label="Filtrar feedback por severidad"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as FilterSeverity)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
          >
            <option value="all" className="bg-neutral-950 text-white">Severity: all</option>
            <option value="low" className="bg-neutral-950 text-white">low</option>
            <option value="medium" className="bg-neutral-950 text-white">medium</option>
            <option value="high" className="bg-neutral-950 text-white">high</option>
            <option value="critical" className="bg-neutral-950 text-white">critical</option>
          </select>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-neutral-400">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-300" />
            Cargando feedback real...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-4 text-sm text-red-200">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-neutral-500">
            No hay feedback para los filtros actuales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Severity</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Usuario</th>
                  <th className="table-header">Empresa</th>
                  <th className="table-header">Ruta</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'cursor-pointer border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]',
                      selectedItem?.id === item.id && 'bg-blue-500/[0.06]'
                    )}
                    onClick={() => setSelectedItem(item)}
                  >
                    <td className="table-cell text-neutral-400">{toDate(item.createdAt)?.toLocaleString() || '-'}</td>
                    <td className="table-cell uppercase text-neutral-300">{item.status}</td>
                    <td className="table-cell uppercase text-neutral-300">{item.severity}</td>
                    <td className="table-cell uppercase text-neutral-300">{item.type}</td>
                    <td className="table-cell text-white">{item.title}</td>
                    <td className="table-cell text-neutral-300">{item.userEmail}</td>
                    <td className="table-cell text-neutral-300">{item.companyName || item.companyId}</td>
                    <td className="table-cell font-mono text-[11px] text-neutral-500">{item.pagePath}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedItem ? (
        <div className="fixed inset-0 z-[75] flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setSelectedItem(null)} />
          <div className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-neutral-950 px-6 py-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-neutral-500">Feedback Detail</p>
                <h3 className="mt-2 text-xl font-bold text-white">{selectedItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-neutral-500 transition-colors hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Contexto</p>
                  <p className="mt-3">Type: <span className="uppercase text-white">{selectedItem.type}</span></p>
                  <p>Severity: <span className="uppercase text-white">{selectedItem.severity}</span></p>
                  <p>Status: <span className="uppercase text-white">{selectedItem.status}</span></p>
                  <p className="mt-3">Ruta:</p>
                  <p className="font-mono text-[11px] text-neutral-500">{selectedItem.pagePath}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Origen</p>
                  <p className="mt-3">{selectedItem.userEmail}</p>
                  <p>{selectedItem.userName || 'Sin nombre'}</p>
                  <p className="mt-3">{selectedItem.companyName || 'Sin nombre de empresa'}</p>
                  <p className="font-mono text-[11px] text-neutral-500">{selectedItem.companyId}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Mensaje</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{selectedItem.message}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Timestamps</p>
                  <p className="mt-3">Created: {toDate(selectedItem.createdAt)?.toLocaleString() || '-'}</p>
                  <p>Updated: {toDate(selectedItem.updatedAt)?.toLocaleString() || '-'}</p>
                  <p>Reviewed: {toDate(selectedItem.reviewedAt)?.toLocaleString() || '-'}</p>
                  <p>Resolved: {toDate(selectedItem.resolvedAt)?.toLocaleString() || '-'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <Label>Status</Label>
                  <select
                    aria-label="Cambiar estado del feedback"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value as PlatformFeedbackStatus)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="open" className="bg-neutral-950 text-white">open</option>
                    <option value="reviewed" className="bg-neutral-950 text-white">reviewed</option>
                    <option value="resolved" className="bg-neutral-950 text-white">resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Admin Notes</Label>
                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Notas internas de seguimiento, causa o decisión."
                  className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-all duration-200 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/24"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
                  <AlertTriangle className="mb-2 h-4 w-4" />
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setSelectedItem(null)}>
                  Cerrar
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

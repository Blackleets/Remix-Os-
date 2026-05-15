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

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: 'Todos',
  open: 'Abierto',
  reviewed: 'Revisado',
  resolved: 'Resuelto',
};

const SEVERITY_LABELS: Record<FilterSeverity, string> = {
  all: 'Todas',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
};

const TYPE_LABELS: Record<PlatformFeedbackItem['type'], string> = {
  bug: 'Bug',
  idea: 'Idea',
  ux: 'UX',
  billing: 'Facturacion',
  copilot: 'Copilot',
  other: 'Otro',
};

function toDate(value?: string | number | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function SuperAdminFeedbackCenter() {
  const [items, setItems] = useState<PlatformFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
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
    setError(null);
    setSaveFeedback(null);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;
    const refreshedItem = items.find((item) => item.id === selectedItem.id);
    if (!refreshedItem) {
      setSelectedItem(null);
      return;
    }
    setSelectedItem(refreshedItem);
  }, [items, selectedItem]);

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

  const hasUnsavedChanges = selectedItem
    ? statusDraft !== selectedItem.status || notesDraft !== (selectedItem.adminNotes || '')
    : false;

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);
    setError(null);
    setSaveFeedback(null);
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
      setSaveFeedback('Feedback actualizado.');
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
            <p className="section-kicker text-neutral-500">Centro feedback</p>
            <h2 className="mt-2 text-lg font-bold text-white">Beta Feedback</h2>
          </div>
          <div className="telemetry-chip !px-3 !py-2">
            <MessageSquareText className="h-4 w-4" />
            <span>{items.length} registros</span>
          </div>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_0.4fr_0.4fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por titulo, mensaje, usuario o empresa"
              className="pl-11"
            />
          </div>
          <select
            aria-label="Filtrar feedback por estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
          >
            <option value="all" className="bg-neutral-950 text-white">Estado: {STATUS_LABELS.all}</option>
            <option value="open" className="bg-neutral-950 text-white">{STATUS_LABELS.open}</option>
            <option value="reviewed" className="bg-neutral-950 text-white">{STATUS_LABELS.reviewed}</option>
            <option value="resolved" className="bg-neutral-950 text-white">{STATUS_LABELS.resolved}</option>
          </select>
          <select
            aria-label="Filtrar feedback por severidad"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as FilterSeverity)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
          >
            <option value="all" className="bg-neutral-950 text-white">Severidad: {SEVERITY_LABELS.all}</option>
            <option value="low" className="bg-neutral-950 text-white">{SEVERITY_LABELS.low}</option>
            <option value="medium" className="bg-neutral-950 text-white">{SEVERITY_LABELS.medium}</option>
            <option value="high" className="bg-neutral-950 text-white">{SEVERITY_LABELS.high}</option>
            <option value="critical" className="bg-neutral-950 text-white">{SEVERITY_LABELS.critical}</option>
          </select>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-neutral-400">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-300" />
            Cargando feedback real...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-4 text-sm text-red-200">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span>{error}</span>
              <Button
                type="button"
                variant="secondary"
                className="w-fit border-red-400/20 bg-black/30 text-red-100"
                onClick={() => setReloadKey((current) => current + 1)}
              >
                Reintentar
              </Button>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-neutral-500">
            <p>{items.length === 0 ? 'Todavia no hay feedback registrado.' : 'No hay feedback para los filtros actuales.'}</p>
            {(statusFilter !== 'all' || severityFilter !== 'all' || search.trim()) ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-4 border-white/10 bg-white/[0.03]"
                onClick={() => {
                  setStatusFilter('all');
                  setSeverityFilter('all');
                  setSearch('');
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Estado</th>
                  <th className="table-header">Severidad</th>
                  <th className="table-header">Tipo</th>
                  <th className="table-header">Titulo</th>
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
                    <td className="table-cell uppercase text-neutral-300">{STATUS_LABELS[item.status]}</td>
                    <td className="table-cell uppercase text-neutral-300">{SEVERITY_LABELS[item.severity]}</td>
                    <td className="table-cell uppercase text-neutral-300">{TYPE_LABELS[item.type]}</td>
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
          <div
            className="absolute inset-0"
            onClick={() => {
              setSelectedItem(null);
              setError(null);
              setSaveFeedback(null);
            }}
          />
          <div className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-neutral-950 px-6 py-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-neutral-500">Detalle</p>
                <h3 className="mt-2 text-xl font-bold text-white">{selectedItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedItem(null);
                  setError(null);
                  setSaveFeedback(null);
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-neutral-500 transition-colors hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Contexto</p>
                  <p className="mt-3">Tipo: <span className="uppercase text-white">{TYPE_LABELS[selectedItem.type]}</span></p>
                  <p>Severidad: <span className="uppercase text-white">{SEVERITY_LABELS[selectedItem.severity]}</span></p>
                  <p>Estado: <span className="uppercase text-white">{STATUS_LABELS[selectedItem.status]}</span></p>
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
                  <p className="mt-3">Creado: {toDate(selectedItem.createdAt)?.toLocaleString() || '-'}</p>
                  <p>Actualizado: {toDate(selectedItem.updatedAt)?.toLocaleString() || '-'}</p>
                  <p>Revisado: {toDate(selectedItem.reviewedAt)?.toLocaleString() || '-'}</p>
                  <p>Resuelto: {toDate(selectedItem.resolvedAt)?.toLocaleString() || '-'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <Label>Estado</Label>
                  <select
                    aria-label="Cambiar estado del feedback"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value as PlatformFeedbackStatus)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="open" className="bg-neutral-950 text-white">{STATUS_LABELS.open}</option>
                    <option value="reviewed" className="bg-neutral-950 text-white">{STATUS_LABELS.reviewed}</option>
                    <option value="resolved" className="bg-neutral-950 text-white">{STATUS_LABELS.resolved}</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Notas internas</Label>
                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Notas internas de seguimiento, causa o decision."
                  className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-all duration-200 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/24"
                />
              </div>

              {saveFeedback ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-200">
                  {saveFeedback}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
                  <AlertTriangle className="mb-2 h-4 w-4" />
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectedItem(null);
                    setError(null);
                    setSaveFeedback(null);
                  }}
                >
                  Cerrar
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving || !hasUnsavedChanges} className="gap-2">
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

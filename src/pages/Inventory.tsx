import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Label, cn } from '../components/Common';
import { Move, ArrowDownLeft, ArrowUpRight, History, Download, ShieldAlert, Boxes, Radar, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { collection, query, where, serverTimestamp, orderBy, doc, increment, runTransaction, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { exportToCSV } from '../lib/exportUtils';
import { EmptyStatePanel } from '../components/EmptyStatePanel';

interface Movement {
  id: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  productName: string;
  createdAt: any;
}

export function Inventory() {
  const { company } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: '', quantity: '', type: 'in', reason: '' });

  const { canEditInventory } = usePermissions();

  useEffect(() => {
    if (!company) return;

    const qMoved = query(
      collection(db, 'inventoryMovements'),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeMovements = onSnapshot(qMoved, (snap) => {
      setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Movement)));
    }, (error) => {
      console.error('Inventory movements listener error:', error);
    });

    const qProd = query(collection(db, 'products'), where('companyId', '==', company.id));
    const unsubscribeProducts = onSnapshot(qProd, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Inventory products listener error:', error);
    });

    return () => {
      unsubscribeMovements();
      unsubscribeProducts();
    };
  }, [company]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    if (!form.productId || !form.quantity || !company) return;
    const qty = parseInt(form.quantity);
    if (!qty || qty < 1) {
      setAdjustError('La cantidad debe ser mayor o igual a 1.');
      return;
    }

    setLoading(true);
    try {
      const product = products.find((p) => p.id === form.productId);

      await runTransaction(db, async (transaction) => {
        const prodRef = doc(db, 'products', form.productId);
        const prodSnap = await transaction.get(prodRef);

        if (!prodSnap.exists()) throw new Error(t('inventory.alerts.not_found'));

        const currentStock = prodSnap.data().stockLevel || 0;
        if (form.type === 'out' && currentStock < qty) {
          throw new Error(t('inventory.alerts.insufficient', { count: currentStock }));
        }

        const moveRef = doc(collection(db, 'inventoryMovements'));
        transaction.set(moveRef, {
          ...form,
          quantity: qty,
          productName: product?.name || 'Unknown',
          companyId: company.id,
          createdAt: serverTimestamp(),
        });

        transaction.update(prodRef, {
          stockLevel: increment(form.type === 'in' ? qty : -qty),
        });

        const actRef = doc(collection(db, 'activities'));
        transaction.set(actRef, {
          type: 'inventory_update',
          title: `Stock ${form.type.toUpperCase()}`,
          subtitle: `${product?.name || 'Item'} (${form.type === 'in' ? '+' : '-'}${qty})`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      });

      setForm({ productId: '', quantity: '', type: 'in', reason: '' });
    } catch (err: any) {
      setAdjustError(err.message || t('inventory.alerts.failed'));
    } finally {
      setLoading(false);
    }
  };

  const inflowCount = movements.filter((m) => m.type === 'in').length;
  const outflowCount = movements.filter((m) => m.type === 'out').length;
  const lowStockProducts = products.filter((p) => (p.stockLevel || 0) <= 10).length;
  const criticalStockProducts = products.filter((p) => (p.stockLevel || 0) <= 3).slice(0, 4);

  const getMovementLabel = (type: Movement['type']) => (type === 'in' ? 'Entrada' : 'Salida');

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="hero-gradient overflow-hidden rounded-[30px] border border-white/10 p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="operator-badge">
                <span className="status-dot bg-blue-400 text-blue-400" />
                Control de inventario
              </span>
              <span className="telemetry-chip">
                <Radar className="h-3 w-3 text-blue-300" />
                Stock en vigilancia
              </span>
            </div>
            <h1 className="section-title text-4xl md:text-5xl">{t('inventory.title')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300 md:text-base">
              Controla existencias, registra ajustes y revisa movimientos desde una sola vista operativa.
            </p>
          </div>
          <Button
            variant="secondary"
            className="h-12 gap-2 px-6"
            onClick={() => exportToCSV(movements.map((m) => ({
              ID: m.id,
              Type: m.type,
              Quantity: m.quantity,
              Reason: m.reason,
              Product: m.productName,
              Date: m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toISOString() : m.createdAt,
            })), 'inventory_movements')}
            disabled={movements.length === 0}
          >
            <Download className="w-4 h-4" /> {t('common.export')}
          </Button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Entradas</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{inflowCount}</p>
                <p className="mt-1 text-sm text-neutral-400">Reposiciones registradas en el historial reciente.</p>
              </div>
              <ArrowDownLeft className="h-5 w-5 text-emerald-300" />
            </div>
          </div>
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Salidas</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{outflowCount}</p>
                <p className="mt-1 text-sm text-neutral-400">Reducciones de stock registradas por la operacion.</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-amber-300" />
            </div>
          </div>
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Stock bajo</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{lowStockProducts}</p>
                <p className="mt-1 text-sm text-neutral-400">Productos por debajo del nivel recomendado.</p>
              </div>
              <Sparkles className="h-5 w-5 text-blue-300" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {criticalStockProducts.length > 0 && (
            <Card className="mb-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="section-kicker mb-2">Alerta</p>
                  <h2 className="section-title text-2xl">Reposicion prioritaria</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/14 bg-amber-500/10">
                  <ShieldAlert className="w-4 h-4 text-amber-300" />
                </div>
              </div>
              <div className="space-y-3">
                {criticalStockProducts.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{product.name}</p>
                        <p className="mt-1 text-[11px] text-neutral-400">SKU: {product.sku || '-'}</p>
                      </div>
                      <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                        {product.stockLevel || 0} {t('inventory.units')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canEditInventory ? (
            <Card className="h-fit">
              <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/[0.05] pb-4">
                <div>
                  <p className="section-kicker mb-2">Ajuste</p>
                  <h2 className="section-title text-2xl">{t('inventory.manual_adjustment')}</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/14 bg-blue-500/10">
                  <Move className="w-4 h-4 text-blue-300" />
                </div>
              </div>
              <form onSubmit={handleAdjust} className="space-y-6">
                <div className="space-y-2">
                  <Label>{t('inventory.target_asset')}</Label>
                  <select
                    aria-label={t('inventory.target_asset')}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={form.productId}
                    onChange={(e) => setForm({ ...form, productId: e.target.value })}
                    required
                  >
                    <option value="" className="bg-neutral-900 italic">{t('inventory.select_asset')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id} className="bg-neutral-900">
                        {p.name} [{p.stockLevel} {t('inventory.units')}]
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('inventory.vector_type')}</Label>
                    <select
                      aria-label={t('inventory.vector_type')}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    >
                      <option value="in" className="bg-neutral-900">{t('inventory.inflow')}</option>
                      <option value="out" className="bg-neutral-900">{t('inventory.outflow')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('inventory.quantity')}</Label>
                    <Input
                      type="number"
                      required
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('inventory.rationale')}</Label>
                  <Input
                    placeholder={t('inventory.rationale_placeholder')}
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </div>
                {adjustError && (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{adjustError}</p>
                )}
                <Button type="submit" disabled={loading} className="h-12 w-full text-sm font-bold uppercase tracking-widest">
                  {loading ? t('settings.syncing_msg') : t('inventory.commit')}
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="space-y-6 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                <ShieldAlert className="w-8 h-8 text-red-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">{t('inventory.access_denied')}</h3>
                <p className="text-[11px] italic leading-relaxed text-neutral-500">{t('inventory.access_denied_desc')}</p>
              </div>
            </Card>
          )}
        </div>

        <Card className="overflow-hidden p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.02] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03]">
                <History className="w-4 h-4 text-neutral-300" />
              </div>
              <div>
                <p className="section-kicker mb-1">Movimientos</p>
                <h2 className="section-title text-2xl">{t('inventory.movement_logs')}</h2>
              </div>
            </div>
            <span className="telemetry-chip !px-2.5 !py-1">{movements.length} eventos</span>
          </div>
          <div className="hidden max-h-[600px] overflow-x-auto overflow-y-auto sm:block">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[rgba(6,10,16,0.92)] backdrop-blur-xl">
                  <th className="table-header">{t('inventory.table.timestamp')}</th>
                  <th className="table-header">{t('inventory.table.asset')}</th>
                  <th className="table-header">{t('inventory.table.delta')}</th>
                  <th className="table-header">{t('inventory.table.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((move) => (
                  <tr key={move.id} className="group border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                    <td className="table-cell">
                      <span className="font-mono text-[10px] font-bold uppercase text-neutral-600">
                        {move.createdAt?.toDate ? format(move.createdAt.toDate(), 'MM/dd HH:mm:ss') : t('inventory.table.live')}
                      </span>
                    </td>
                    <td className="table-cell font-bold text-neutral-100">{move.productName}</td>
                    <td className="table-cell">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                        move.type === 'in'
                          ? 'border-emerald-400/16 bg-emerald-500/8 text-emerald-200'
                          : 'border-red-400/16 bg-red-500/8 text-red-200'
                      )}>
                        {move.type === 'in' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {getMovementLabel(move.type)}: {move.quantity}
                      </span>
                    </td>
                    <td className="table-cell">
                      <p className="max-w-xs truncate text-[11px] italic text-neutral-500">{move.reason || t('inventory.table.manual')}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="max-h-[500px] divide-y divide-white/[0.05] overflow-y-auto sm:hidden">
            {movements.map((move) => (
              <div key={move.id} className="space-y-2 p-4 active:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold uppercase text-neutral-600">
                    {move.createdAt?.toDate ? format(move.createdAt.toDate(), 'MM/dd HH:mm:ss') : t('inventory.table.syncing')}
                  </span>
                  <span className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                    move.type === 'in'
                      ? 'border-emerald-400/16 bg-emerald-500/8 text-emerald-200'
                      : 'border-red-400/16 bg-red-500/8 text-red-200'
                  )}>
                    {move.type === 'in' ? '+' : '-'}{move.quantity}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-200">{move.productName}</p>
                  <p className="mt-0.5 truncate text-[10px] italic text-neutral-500">{move.reason || 'Ajuste manual'}</p>
                </div>
              </div>
            ))}
          </div>

          {movements.length === 0 && (
            <div className="px-4 py-16 sm:px-6">
              {products.length === 0 ? (
                <EmptyStatePanel
                  eyebrow="Inventario"
                  title="Necesitas productos para activar el inventario."
                  description="Crea tu catálogo primero. Después podrás registrar movimientos y activar alertas de reposición."
                  icon={<Boxes className="h-7 w-7" />}
                  primaryActionLabel="Añadir producto"
                  onPrimaryAction={() => navigate('/products')}
                  secondaryActionLabel="Ver catálogo"
                  onSecondaryAction={() => navigate('/products')}
                />
              ) : (
                <EmptyStatePanel
                  eyebrow="Inventario"
                  title="Controla tu stock desde aquí."
                  description="Gestiona existencias, detecta faltantes y activa alertas de reposición."
                  icon={<Boxes className="h-7 w-7" />}
                  primaryActionLabel={canEditInventory ? 'Registrar movimiento' : undefined}
                  onPrimaryAction={canEditInventory ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}
                  secondaryActionLabel="Ver catálogo"
                  onSecondaryAction={() => navigate('/products')}
                />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

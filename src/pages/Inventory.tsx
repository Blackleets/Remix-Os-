import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Input, Label, cn } from '../components/Common';
import {
  Move,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Download,
  ShieldAlert,
  AlertTriangle,
  Package,
  Tag,
  DollarSign,
  TrendingDown,
  X,
  RefreshCcw,
  BoxSelect,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { exportToCSV } from '../lib/exportUtils';
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';
import { ProductLike, InventoryMovementLike } from '../lib/businessMetrics';
import { bucketByDay, getDateRanges, isInRange, tsToDate } from '../lib/dateMetrics';
import { clampPositive } from '../lib/moneyUtils';

type TypeFilter = 'all' | 'in' | 'out';
type AlertTab = 'low' | 'out' | 'no_sku' | 'no_cost';

const LOW_STOCK_THRESHOLD = 10;

export function Inventory() {
  const { company } = useAuth();
  const { t, formatCurrency } = useLocale();
  const navigate = useNavigate();
  const { canEditInventory } = usePermissions();

  const metrics = useBusinessMetrics({ include: ['inventory', 'products'] });
  const inventory = metrics.inventory;
  const productsList = metrics.raw.products as ProductLike[];
  const movements = metrics.raw.movements as InventoryMovementLike[];

  const [loading, setLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: '', quantity: '', type: 'in' as 'in' | 'out', reason: '' });

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [alertTab, setAlertTab] = useState<AlertTab>('low');
  const [historyProduct, setHistoryProduct] = useState<ProductLike | null>(null);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (productFilter !== 'all' && m.productId !== productFilter) return false;
      return true;
    });
  }, [movements, typeFilter, productFilter]);

  const hasActiveFilters = typeFilter !== 'all' || productFilter !== 'all';

  const movementChartData = useMemo(() => {
    const ranges = getDateRanges();
    const buckets = bucketByDay(movements, (m) => m.createdAt, ranges.last30Days);
    return Array.from(buckets.entries()).map(([key, items]) => ({
      key,
      name: format(new Date(key), 'MMM d'),
      inflow: items.filter((m) => m.type === 'in').reduce((s, m) => s + clampPositive(m.quantity), 0),
      outflow: items.filter((m) => m.type === 'out').reduce((s, m) => s + clampPositive(m.quantity), 0),
    }));
  }, [movements]);

  const chartHasData = movementChartData.some((d) => d.inflow > 0 || d.outflow > 0);

  // Reorder suggestion: low/out products with sustained outflow last 30 days.
  const reorderSuggestions = useMemo(() => {
    const ranges = getDateRanges();
    const recentOut = new Map<string, number>();
    for (const m of movements) {
      if (m.type !== 'out') continue;
      if (!isInRange(m.createdAt, ranges.last30Days)) continue;
      recentOut.set(m.productId, (recentOut.get(m.productId) || 0) + clampPositive(m.quantity));
    }
    return productsList
      .map((p) => ({
        product: p,
        outflow30d: recentOut.get(p.id) || 0,
        stock: clampPositive(p.stockLevel),
      }))
      .filter((row) => row.outflow30d > 0 && row.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => b.outflow30d / Math.max(1, b.stock || 1) - a.outflow30d / Math.max(1, a.stock || 1))
      .slice(0, 6);
  }, [movements, productsList]);

  const productHistory = useMemo(() => {
    if (!historyProduct) return [];
    return movements
      .filter((m) => m.productId === historyProduct.id)
      .slice()
      .sort((a, b) => {
        const da = tsToDate(a.createdAt)?.getTime() || 0;
        const db = tsToDate(b.createdAt)?.getTime() || 0;
        return db - da;
      })
      .slice(0, 25);
  }, [movements, historyProduct]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    if (!company) return;
    if (!form.productId) {
      setAdjustError(t('inventory.alerts.not_found'));
      return;
    }
    if (!form.reason.trim()) {
      setAdjustError(t('inventory.rationale_required'));
      return;
    }
    const qty = parseInt(form.quantity, 10);
    if (!qty || qty < 1) {
      setAdjustError(t('inventory.alerts.failed'));
      return;
    }

    setLoading(true);
    try {
      const product = productsList.find((p) => p.id === form.productId);
      await runTransaction(db, async (transaction) => {
        const prodRef = doc(db, 'products', form.productId);
        const prodSnap = await transaction.get(prodRef);

        if (!prodSnap.exists()) throw new Error(t('inventory.alerts.not_found'));

        const currentStock = (prodSnap.data() as any).stockLevel || 0;
        if (form.type === 'out' && currentStock < qty) {
          throw new Error(t('inventory.alerts.insufficient', { count: currentStock }));
        }

        const moveRef = doc(collection(db, 'inventoryMovements'));
        transaction.set(moveRef, {
          productId: form.productId,
          type: form.type,
          quantity: qty,
          reason: form.reason.trim(),
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
          subtitle: `${product?.name || 'Item'} (${form.type === 'in' ? '+' : '-'}${qty}) · ${form.reason.trim()}`,
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

  const handleExportCSV = () => {
    const rows = filteredMovements.map((m) => ({
      ID: m.id,
      Type: m.type,
      Quantity: m.quantity,
      Reason: m.reason || '',
      Product: m.productName || '',
      Date: tsToDate(m.createdAt)?.toISOString() || '',
    }));
    exportToCSV(rows, 'inventory_movements');
  };

  const lowStock = inventory?.lowStockProducts || [];
  const outOfStock = inventory?.outOfStockProducts || [];
  const productsWithoutSKU = useMemo(
    () => productsList.filter((p) => !p.sku || p.sku.trim().length === 0),
    [productsList]
  );
  const productsWithoutCost = useMemo(
    () => productsList.filter((p) => typeof p.costPrice !== 'number' || p.costPrice <= 0),
    [productsList]
  );

  const alertSets: Record<AlertTab, ProductLike[]> = {
    low: lowStock,
    out: outOfStock,
    no_sku: productsWithoutSKU,
    no_cost: productsWithoutCost,
  };

  const alertTabs: { key: AlertTab; label: string; count: number; tone: string }[] = [
    {
      key: 'low',
      label: t('inventory.alerts_panel.tab_low'),
      count: lowStock.length,
      tone: lowStock.length > 0 ? 'amber' : 'neutral',
    },
    {
      key: 'out',
      label: t('inventory.alerts_panel.tab_out'),
      count: outOfStock.length,
      tone: outOfStock.length > 0 ? 'red' : 'neutral',
    },
    {
      key: 'no_sku',
      label: t('inventory.alerts_panel.tab_no_sku'),
      count: productsWithoutSKU.length,
      tone: productsWithoutSKU.length > 0 ? 'blue' : 'neutral',
    },
    {
      key: 'no_cost',
      label: t('inventory.alerts_panel.tab_no_cost'),
      count: productsWithoutCost.length,
      tone: productsWithoutCost.length > 0 ? 'blue' : 'neutral',
    },
  ];

  const renderTile = (
    key: string,
    Icon: any,
    label: string,
    value: string,
    tone: string,
    sub?: string
  ) => (
    <Card key={key} className="p-5 h-full">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center', tone)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-neutral-600 font-mono mt-1">{sub}</p>}
    </Card>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">
            {t('inventory.title')}
          </h1>
          <p className="text-neutral-500 text-sm">{t('inventory.subtitle')}</p>
        </div>
        <Button
          variant="secondary"
          className="gap-2 px-6 h-12"
          onClick={handleExportCSV}
          disabled={filteredMovements.length === 0}
        >
          <Download className="w-4 h-4" /> {t('common.export')}
        </Button>
      </div>

      {/* Tiles row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {renderTile(
          'total-stock',
          Package,
          t('inventory.tiles.total_stock'),
          (inventory?.totalStockUnits ?? 0).toString(),
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
        )}
        {renderTile(
          'total-value',
          DollarSign,
          t('inventory.tiles.total_value'),
          formatCurrency(inventory?.totalStockValue ?? 0),
          'border-blue-500/20 bg-blue-500/10 text-blue-400',
          inventory && inventory.estimatedCostValue > 0
            ? t('inventory.tiles.coverage') + ` ${formatCurrency(inventory.estimatedCostValue)}`
            : undefined
        )}
        {renderTile(
          'estimated-margin',
          TrendingDown,
          t('inventory.tiles.estimated_margin'),
          formatCurrency(inventory?.estimatedGrossMargin ?? 0),
          'border-purple-500/20 bg-purple-500/10 text-purple-400'
        )}
        {renderTile(
          'alerts',
          AlertTriangle,
          t('inventory.tiles.alerts'),
          ((inventory?.lowStockProducts.length ?? 0) + (inventory?.outOfStockProducts.length ?? 0)).toString(),
          (inventory?.outOfStockProducts.length ?? 0) > 0
            ? 'border-red-500/20 bg-red-500/10 text-red-400'
            : (inventory?.lowStockProducts.length ?? 0) > 0
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
          t('inventory.tiles.alerts_subtitle', {
            low: inventory?.lowStockProducts.length ?? 0,
            out: inventory?.outOfStockProducts.length ?? 0,
          })
        )}
      </div>

      {/* Alerts panel + Reorder suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="p-6 lg:col-span-2 border-white/5 bg-neutral-900/40">
          <div className="flex items-start justify-between mb-5 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600 mb-1">
                {t('inventory.alerts_panel.subtitle')}
              </p>
              <h2 className="font-display text-xl font-bold text-white">{t('inventory.alerts_panel.title')}</h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {alertTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAlertTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-2',
                  alertTab === tab.key
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:text-neutral-300'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded text-[9px] font-mono',
                    tab.tone === 'red'
                      ? 'bg-red-500/15 text-red-400'
                      : tab.tone === 'amber'
                        ? 'bg-amber-500/15 text-amber-400'
                        : tab.tone === 'blue'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-white/[0.04] text-neutral-500'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <AlertList
            tab={alertTab}
            products={alertSets[alertTab]}
            onSelectProduct={(p) => setHistoryProduct(p)}
            onOpenCatalog={() => navigate('/products')}
          />
        </Card>

        <Card className="p-6 border-white/5 bg-neutral-900/40">
          <div className="flex items-start justify-between mb-5 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600 mb-1">
                {t('inventory.reorder.subtitle')}
              </p>
              <h2 className="font-display text-xl font-bold text-white">{t('inventory.reorder.title')}</h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <RefreshCcw className="w-4 h-4" />
            </div>
          </div>

          {reorderSuggestions.length === 0 ? (
            <p className="text-xs text-neutral-500 leading-relaxed">{t('inventory.reorder.empty')}</p>
          ) : (
            <div className="space-y-2">
              {reorderSuggestions.map((row) => {
                const urgent = row.stock <= 0 || row.outflow30d >= row.stock * 2;
                return (
                  <button
                    key={row.product.id}
                    type="button"
                    onClick={() => setHistoryProduct(row.product)}
                    className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-200 truncate">{row.product.name || '—'}</p>
                      <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider truncate">
                        {t('inventory.reorder.movement_label', { out: row.outflow30d, stock: row.stock })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-lg whitespace-nowrap',
                        urgent
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      )}
                    >
                      {urgent ? t('inventory.reorder.urgent') : t('inventory.reorder.recommended')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Movement chart */}
      <Card className="p-6 border-white/5 bg-neutral-900/40">
        <div className="flex justify-between items-start mb-5 gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600 mb-1">
              {t('inventory.chart.subtitle')}
            </p>
            <h2 className="font-display text-xl font-bold text-white">{t('inventory.chart.title')}</h2>
          </div>
        </div>
        <div className="h-[260px] -mx-2">
          {chartHasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movementChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#666', fontWeight: 600 }}
                  dy={10}
                  interval={4}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A0A0A',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#999' }} />
                <Bar dataKey="inflow" name={t('inventory.chart.inflow')} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflow" name={t('inventory.chart.outflow')} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-600 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
              <BoxSelect className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-widest">{t('inventory.chart.empty')}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Form + movements table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          {canEditInventory ? (
            <Card className="p-6 h-fit bg-neutral-900 shadow-2xl border-white/5">
              <div className="flex items-center gap-3 mb-6 border-b border-white/[0.05] pb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                  <Move className="w-4 h-4 text-blue-500" />
                </div>
                <h2 className="font-display font-bold text-lg text-white uppercase tracking-tight">
                  {t('inventory.manual_adjustment')}
                </h2>
              </div>
              <form onSubmit={handleAdjust} className="space-y-5">
                <div className="space-y-2">
                  <Label>{t('inventory.target_asset')}</Label>
                  <select
                    aria-label={t('inventory.target_asset')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                    value={form.productId}
                    onChange={(e) => setForm({ ...form, productId: e.target.value })}
                    required
                  >
                    <option value="" className="bg-neutral-900 italic">
                      {t('inventory.select_asset')}
                    </option>
                    {productsList.map((p) => (
                      <option key={p.id} value={p.id} className="bg-neutral-900">
                        {p.name} [{p.stockLevel} {t('inventory.units')}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('inventory.vector_type')}</Label>
                    <select
                      aria-label={t('inventory.vector_type')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as 'in' | 'out' })}
                    >
                      <option value="in" className="bg-neutral-900">
                        {t('inventory.inflow')}
                      </option>
                      <option value="out" className="bg-neutral-900">
                        {t('inventory.outflow')}
                      </option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('inventory.quantity')}</Label>
                    <Input
                      type="number"
                      min="1"
                      required
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    {t('inventory.rationale')} <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    required
                    placeholder={t('inventory.rationale_placeholder')}
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                  <p className="text-[10px] text-neutral-600 leading-relaxed">{t('inventory.rationale_required')}</p>
                </div>

                {adjustError && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {adjustError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-sm font-bold uppercase tracking-widest shadow-lg shadow-blue-600/10"
                >
                  {loading ? t('settings.syncing_msg') : t('inventory.commit')}
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="p-10 text-center bg-neutral-900/40 border-white/5 space-y-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-white font-bold uppercase tracking-widest text-xs">
                  {t('inventory.access_denied')}
                </h3>
                <p className="text-neutral-500 text-[11px] leading-relaxed italic">
                  {t('inventory.access_denied_desc')}
                </p>
              </div>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-2 p-0 overflow-hidden border-white/5 bg-neutral-900/40">
          <div className="p-5 border-b border-white/[0.05] bg-white/[0.01] space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center border border-white/5">
                  <History className="w-4 h-4 text-neutral-400" />
                </div>
                <h2 className="font-display font-bold text-lg text-white uppercase tracking-tight">
                  {t('inventory.movement_logs')}
                </h2>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('all');
                    setProductFilter('all');
                  }}
                  className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                >
                  {t('inventory.filters.reset')}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-600 mr-1">
                {t('inventory.vector_type')}
              </span>
              {([
                { value: 'all', label: t('inventory.filters.type_all') },
                { value: 'in', label: t('inventory.filters.type_in') },
                { value: 'out', label: t('inventory.filters.type_out') },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTypeFilter(opt.value as TypeFilter)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border',
                    typeFilter === opt.value
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                      : 'border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-600 mr-1">
                {t('inventory.target_asset')}
              </span>
              <select
                aria-label={t('inventory.target_asset')}
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 appearance-none max-w-[260px] truncate"
              >
                <option value="all" className="bg-neutral-900">
                  {t('inventory.filters.product_all')}
                </option>
                {productsList.map((p) => (
                  <option key={p.id} value={p.id} className="bg-neutral-900">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[480px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-neutral-900/90 backdrop-blur-md">
                  <th className="table-header">{t('inventory.table.timestamp')}</th>
                  <th className="table-header">{t('inventory.table.asset')}</th>
                  <th className="table-header">{t('inventory.table.delta')}</th>
                  <th className="table-header">{t('inventory.table.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((move) => {
                  const date = tsToDate(move.createdAt);
                  const product = productsList.find((p) => p.id === move.productId);
                  return (
                    <tr
                      key={move.id}
                      className="group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors last:border-0 cursor-pointer"
                      onClick={() => product && setHistoryProduct(product)}
                    >
                      <td className="table-cell">
                        <span className="text-[10px] font-mono font-bold text-neutral-600 uppercase">
                          {date ? format(date, 'MM/dd HH:mm:ss') : t('inventory.table.live')}
                        </span>
                      </td>
                      <td className="table-cell font-bold text-neutral-200">{move.productName || '—'}</td>
                      <td className="table-cell">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 font-bold text-xs px-2 py-1 rounded bg-white/[0.02] border border-white/[0.05]',
                            move.type === 'in' ? 'text-emerald-500' : 'text-red-500'
                          )}
                        >
                          {move.type === 'in' ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {move.type === 'in' ? t('inventory.table.in') : t('inventory.table.out')}:{move.quantity}
                        </span>
                      </td>
                      <td className="table-cell">
                        <p className="text-[11px] text-neutral-500 italic max-w-xs truncate">
                          {move.reason || t('inventory.table.manual')}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden divide-y divide-white/[0.05] overflow-y-auto max-h-[480px]">
            {filteredMovements.map((move) => {
              const date = tsToDate(move.createdAt);
              const product = productsList.find((p) => p.id === move.productId);
              return (
                <div
                  key={move.id}
                  className="p-4 space-y-2 active:bg-white/[0.02]"
                  onClick={() => product && setHistoryProduct(product)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono font-bold text-neutral-600 uppercase">
                      {date ? format(date, 'MM/dd HH:mm:ss') : t('inventory.table.syncing')}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded border',
                        move.type === 'in'
                          ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'
                          : 'text-red-500 border-red-500/20 bg-red-500/5'
                      )}
                    >
                      {move.type === 'in' ? '+' : '-'}{move.quantity}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-200">{move.productName || '—'}</p>
                    <p className="text-[10px] text-neutral-500 italic truncate mt-0.5">
                      {move.reason || t('inventory.manual_adjustment')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {movements.length > 0 && filteredMovements.length === 0 && (
            <div className="py-16 text-center text-neutral-500 text-sm border-t border-white/[0.04] bg-white/[0.01]">
              {t('inventory.filters.no_match')}
            </div>
          )}

          {movements.length === 0 && (
            <div className="py-24 text-center">
              <div className="flex flex-col items-center gap-4 text-neutral-600">
                <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center">
                  <History className="w-6 h-6 opacity-20" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">
                    {t('inventory.empty.title')}
                  </p>
                  <p className="text-xs">{t('inventory.empty.subtitle')}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Per-product history modal */}
      <AnimatePresence>
        {historyProduct && (
          <ProductHistoryModal
            product={historyProduct}
            history={productHistory}
            onClose={() => setHistoryProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AlertList({
  tab,
  products,
  onSelectProduct,
  onOpenCatalog,
}: {
  tab: AlertTab;
  products: ProductLike[];
  onSelectProduct: (p: ProductLike) => void;
  onOpenCatalog: () => void;
}) {
  const { t } = useLocale();

  const emptyKey: Record<AlertTab, string> = {
    low: 'inventory.alerts_panel.empty_low',
    out: 'inventory.alerts_panel.empty_out',
    no_sku: 'inventory.alerts_panel.empty_no_sku',
    no_cost: 'inventory.alerts_panel.empty_no_cost',
  };

  if (products.length === 0) {
    return <p className="text-xs text-neutral-500 leading-relaxed">{t(emptyKey[tab])}</p>;
  }

  return (
    <div className="space-y-2">
      {products.slice(0, 8).map((p) => {
        const stock = clampPositive(p.stockLevel);
        const hasIssueIcon = tab === 'no_sku' ? <Tag className="w-3 h-3" /> : tab === 'no_cost' ? <DollarSign className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />;
        const isOut = tab === 'out';
        return (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all"
          >
            <button
              type="button"
              onClick={() => onSelectProduct(p)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-xs font-bold text-neutral-200 truncate">{p.name || '—'}</p>
              <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider truncate">
                {(p.sku || (tab === 'no_sku' ? 'NO_SKU' : '—'))} ·{' '}
                {tab === 'low' || tab === 'out'
                  ? isOut
                    ? t('inventory.alerts_panel.out_label')
                    : t('inventory.alerts_panel.stock_remaining', { count: stock })
                  : tab === 'no_cost'
                    ? 'cost: —'
                    : `stock: ${stock}`}
              </p>
            </button>
            {(tab === 'no_sku' || tab === 'no_cost') ? (
              <button
                type="button"
                onClick={onOpenCatalog}
                className="text-[9px] uppercase tracking-widest font-bold text-blue-300 hover:text-blue-200 px-2 py-1 rounded-lg border border-blue-500/20 bg-blue-500/10 inline-flex items-center gap-1"
              >
                {hasIssueIcon}
                {t('inventory.alerts_panel.fix_now')}
              </button>
            ) : (
              <span
                className={cn(
                  'text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-lg whitespace-nowrap border',
                  isOut
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                )}
              >
                {isOut ? t('inventory.alerts_panel.out_label') : t('inventory.alerts_panel.stock_remaining', { count: stock })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProductHistoryModal({
  product,
  history,
  onClose,
}: {
  product: ProductLike;
  history: InventoryMovementLike[];
  onClose: () => void;
}) {
  const { t } = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 w-full max-w-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-6 border-b border-white/[0.05] flex justify-between items-start bg-white/[0.02]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600 mb-1">
              {t('inventory.history.title')}
            </p>
            <h2 className="font-display text-lg font-bold text-white">{product.name || '—'}</h2>
            <p className="text-xs text-neutral-500 mt-1">
              {t('inventory.history.subtitle_for', { name: product.sku || product.name || '—' })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('common.close') || 'Close'}
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {history.length === 0 ? (
            <p className="text-xs text-neutral-500 leading-relaxed">{t('inventory.history.empty')}</p>
          ) : (
            <div className="space-y-2">
              {history.map((m) => {
                const date = tsToDate(m.createdAt);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.01]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0',
                          m.type === 'in'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border-red-500/20 bg-red-500/10 text-red-400'
                        )}
                      >
                        {m.type === 'in' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-neutral-100">
                          {m.type === 'in' ? t('inventory.history.inflow') : t('inventory.history.outflow')}
                          <span className="ml-2 font-mono text-neutral-400">
                            {m.type === 'in' ? '+' : '-'}{m.quantity}
                          </span>
                        </p>
                        <p className="text-[10px] text-neutral-500 italic truncate">
                          {m.reason || t('inventory.table.manual')}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-600 uppercase whitespace-nowrap">
                      {date ? format(date, 'MMM dd, HH:mm') : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

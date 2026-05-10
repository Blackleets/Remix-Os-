import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Label, cn } from '../components/Common';
import {
  Plus,
  Search,
  Receipt,
  CreditCard,
  ChevronRight,
  Trash2,
  AlertCircle,
  Download,
  Eye,
  X,
  RotateCcw,
  Wallet,
  Store,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached, getCompanyUsage } from '../lib/plans';
import { exportToCSV, exportPOSReceiptToPDF } from '../lib/exportUtils';
import { createSaleTransaction } from '../services/sales';
import { getDateRanges, isInRange, tsToDate } from '../lib/dateMetrics';
import { toMoney } from '../lib/moneyUtils';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  sku?: string;
}

interface OrderSnapshotItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  sku?: string;
}

interface Order {
  id: string;
  customerId?: string;
  customerName?: string;
  total: number;
  totalAmount?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  status: string;
  paymentMethod?: string;
  channel?: string;
  cashSessionId?: string;
  itemCount?: number;
  itemsSnapshot?: OrderSnapshotItem[];
  createdAt?: any;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stockLevel: number;
}

type StatusFilter = 'all' | 'completed' | 'pending' | 'cancelled';
type ChannelFilter = 'all' | 'pos' | 'orders';
type DateFilter = 'all' | 'today' | 'week' | 'month';

const PAYMENT_OPTIONS = ['Cash', 'Card', 'Transfer', 'Crypto', 'Stripe'] as const;

export function Orders() {
  const { company } = useAuth();
  const { t, formatCurrency } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderSnapshotItem[] | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  const { canEditOrders } = usePermissions();

  useEffect(() => {
    if (location.state?.action === 'create') {
      handleCreateNew();
      setError(null);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const [form, setForm] = useState({
    customerId: '',
    paymentMethod: 'Card',
    items: [] as OrderItem[],
  });

  const handleCreateNew = async () => {
    if (!company) return;
    const planId = company.subscription?.planId || 'starter';
    const plan = PLANS[planId];
    try {
      const usage = await getCompanyUsage(company.id);
      if (isLimitReached(usage.orders, plan.limits.orders)) {
        setIsUpgradeModalOpen(true);
        return;
      }
    } catch (e) {
      console.warn('Plan usage check failed, falling back to local count', e);
      const ranges = getDateRanges();
      const monthly = orders.filter((o) => isInRange(o.createdAt, ranges.thisMonth)).length;
      if (isLimitReached(monthly, plan.limits.orders)) {
        setIsUpgradeModalOpen(true);
        return;
      }
    }
    setForm({ customerId: '', paymentMethod: 'Card', items: [] });
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!company) return;

    const qOrders = query(
      collection(db, 'orders'),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
    });

    const qCust = query(collection(db, 'customers'), where('companyId', '==', company.id));
    const unsubscribeCustomers = onSnapshot(qCust, (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    });

    const qProd = query(collection(db, 'products'), where('companyId', '==', company.id));
    const unsubscribeProducts = onSnapshot(qProd, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
      unsubscribeProducts();
    };
  }, [company]);

  const filteredOrders = useMemo(() => {
    const ranges = getDateRanges();
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter !== 'all' && (order.status || 'completed') !== statusFilter) return false;
      if (channelFilter !== 'all') {
        const channel = order.channel || 'orders';
        if (channelFilter === 'pos' && channel !== 'pos') return false;
        if (channelFilter === 'orders' && channel === 'pos') return false;
      }
      if (paymentFilter !== 'all' && order.paymentMethod !== paymentFilter) return false;
      if (dateFilter !== 'all') {
        const range =
          dateFilter === 'today' ? ranges.today : dateFilter === 'week' ? ranges.thisWeek : ranges.thisMonth;
        if (!isInRange(order.createdAt, range)) return false;
      }
      if (term) {
        const hay = `${order.id} ${order.customerName ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, channelFilter, paymentFilter, dateFilter]);

  const hasActiveFilters =
    !!search.trim() ||
    statusFilter !== 'all' ||
    channelFilter !== 'all' ||
    paymentFilter !== 'all' ||
    dateFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setChannelFilter('all');
    setPaymentFilter('all');
    setDateFilter('all');
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { productId: '', productName: '', quantity: 1, price: 0 }] });
  };
  const removeItem = (index: number) => {
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm({ ...form, items: newItems });
  };
  const updateItem = (index: number, fields: Partial<OrderItem>) => {
    const newItems = [...form.items];
    const item = { ...newItems[index], ...fields };
    if (fields.productId) {
      const p = products.find((prod) => prod.id === fields.productId);
      if (p) {
        item.productName = p.name;
        item.price = p.price;
      }
    }
    newItems[index] = item;
    setForm({ ...form, items: newItems });
  };
  const calculateTotal = () => form.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !form.customerId || form.items.length === 0) {
      setError(t('orders.errors.select_customer_item'));
      return;
    }
    if (form.items.some((i) => !i.productId)) {
      setError(t('orders.errors.select_product'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const customer = customers.find((c) => c.id === form.customerId);
      const total = calculateTotal();
      await createSaleTransaction({
        companyId: company.id,
        customerId: form.customerId,
        customerName: customer?.name || t('orders.guest'),
        paymentMethod: form.paymentMethod,
        items: form.items,
        subtotal: total,
        discount: 0,
        tax: 0,
        total,
        channel: 'orders',
        movementReason: 'Sale',
        activityTitle: 'Order Confirmed',
        messages: {
          productNotFound: (name) => t('orders.errors.not_found', { name }),
          insufficientStock: (name, count) => t('orders.errors.insufficient', { name, count }),
        },
      });
      setIsModalOpen(false);
      setForm({ customerId: '', paymentMethod: 'Card', items: [] });
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('orders.errors.failed'));
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (order: Order) => {
    setDetailOrder(order);
    if (order.itemsSnapshot && order.itemsSnapshot.length > 0) {
      setDetailItems(order.itemsSnapshot);
      return;
    }
    setIsLoadingItems(true);
    setDetailItems(null);
    try {
      const snap = await getDocs(collection(db, 'orders', order.id, 'items'));
      setDetailItems(
        snap.docs.map((d) => ({
          productId: d.data().productId,
          productName: d.data().productName,
          quantity: d.data().quantity,
          price: d.data().price,
          sku: d.data().sku,
        }))
      );
    } catch (err) {
      console.warn('Failed to load order items:', err);
      setDetailItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const closeDetail = () => {
    setDetailOrder(null);
    setDetailItems(null);
  };

  const handleDownloadReceipt = async (order: Order, items: OrderSnapshotItem[]) => {
    if (!company) return;
    setIsDownloadingReceipt(true);
    try {
      const subtotal = order.subtotal ?? items.reduce((s, it) => s + it.price * it.quantity, 0);
      const discount = order.discount ?? 0;
      const tax = order.tax ?? 0;
      const total = order.total ?? order.totalAmount ?? subtotal - discount + tax;
      const createdDate = tsToDate(order.createdAt) ?? new Date();

      await exportPOSReceiptToPDF({
        companyName: company.name || 'Remix',
        logoURL: company.logoURL,
        orderId: order.id,
        createdAt: createdDate,
        customerName: order.customerName || t('orders.guest'),
        paymentMethod: order.paymentMethod || '—',
        subtotal,
        discount,
        tax,
        total,
        cashSessionId: order.cashSessionId || undefined,
        items: items.map((it) => ({
          name: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          price: it.price,
        })),
      });
    } catch (err) {
      console.error('Receipt PDF error:', err);
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const handleExportCSV = () => {
    const rows = filteredOrders.map((o) => ({
      ID: o.id,
      Customer: o.customerName || '',
      Channel: o.channel || 'orders',
      Payment: o.paymentMethod || '',
      Subtotal: o.subtotal ?? '',
      Discount: o.discount ?? '',
      Tax: o.tax ?? '',
      Total: o.total ?? o.totalAmount ?? 0,
      Status: o.status || '',
      Date: tsToDate(o.createdAt)?.toISOString() || '',
    }));
    exportToCSV(rows, 'orders');
  };

  const channelLabel = (channel?: string) =>
    channel === 'pos' ? t('orders.filters.channel_pos') : t('orders.filters.channel_orders');

  const statusBadgeClass = (status?: string) => {
    if (status === 'cancelled') return 'bg-red-500/10 border-red-500/20 text-red-400';
    if (status === 'pending') return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">{t('orders.title')}</h1>
          <p className="text-neutral-500 text-sm">{t('orders.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="gap-2 px-6"
            onClick={handleExportCSV}
            disabled={filteredOrders.length === 0}
          >
            <Download className="w-4 h-4" /> {t('common.export')}
          </Button>
          {canEditOrders && (
            <Button onClick={() => { handleCreateNew(); setError(null); }} className="gap-2 px-6 shadow-lg shadow-blue-600/20">
              <Plus className="w-4 h-4" /> {t('orders.log_transaction')}
            </Button>
          )}
        </div>
      </div>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={t('orders.upgrade.title') || 'Transaction Limit Reached'}
        message={t('orders.upgrade.message') || 'Monthly transaction throughput has peaked for your current plan. Synchronize to a higher tier to restore commercial flow.'}
        limitName={t('orders.limit_name') || 'Monthly Orders'}
      />

      <Card className="relative overflow-hidden border-white/5 bg-neutral-900/40 p-0">
        <div className="p-5 border-b border-white/[0.05] bg-white/[0.01] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div className="relative max-w-md group w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('orders.search_placeholder')}
                className="pl-10 h-11 bg-black/40 border-white/10"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
              >
                {t('orders.filters.reset')}
              </button>
            )}
          </div>

          <FilterChipGroup
            label={t('orders.table.status')}
            options={[
              { value: 'all', label: t('orders.filters.all') },
              { value: 'completed', label: t('orders.filters.status_completed') },
              { value: 'pending', label: t('orders.filters.status_pending') },
              { value: 'cancelled', label: t('orders.filters.status_cancelled') },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />

          <FilterChipGroup
            label={t('orders.table.channel')}
            options={[
              { value: 'all', label: t('orders.filters.channel_all') },
              { value: 'pos', label: t('orders.filters.channel_pos') },
              { value: 'orders', label: t('orders.filters.channel_orders') },
            ]}
            value={channelFilter}
            onChange={(v) => setChannelFilter(v as ChannelFilter)}
          />

          <FilterChipGroup
            label={t('orders.modal.payment_method')}
            options={[
              { value: 'all', label: t('orders.filters.payment_all') },
              ...PAYMENT_OPTIONS.map((p) => ({ value: p, label: p })),
            ]}
            value={paymentFilter}
            onChange={setPaymentFilter}
          />

          <FilterChipGroup
            label={t('orders.table.timestamp')}
            options={[
              { value: 'all', label: t('orders.filters.date_all') },
              { value: 'today', label: t('orders.filters.date_today') },
              { value: 'week', label: t('orders.filters.date_week') },
              { value: 'month', label: t('orders.filters.date_month') },
            ]}
            value={dateFilter}
            onChange={(v) => setDateFilter(v as DateFilter)}
          />
        </div>

        <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[640px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neutral-900/90 backdrop-blur-md">
                <th className="table-header">{t('orders.table.id')}</th>
                <th className="table-header">{t('orders.table.timestamp')}</th>
                <th className="table-header">{t('orders.table.counterparty')}</th>
                <th className="table-header">{t('orders.table.channel')}</th>
                <th className="table-header">{t('orders.table.modality')}</th>
                <th className="table-header">{t('orders.table.total')}</th>
                <th className="table-header">{t('orders.table.status')}</th>
                <th className="table-header text-right">{t('orders.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, i) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors last:border-0 cursor-pointer"
                  onClick={() => openDetail(order)}
                >
                  <td className="table-cell">
                    <span className="font-mono text-[11px] text-neutral-500 uppercase tracking-tighter">
                      NODE_#{order.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase">
                      {tsToDate(order.createdAt)
                        ? format(tsToDate(order.createdAt) as Date, 'MMM dd, HH:mm')
                        : t('orders.table.pending')}
                    </span>
                  </td>
                  <td className="table-cell font-bold text-neutral-200">{order.customerName || '—'}</td>
                  <td className="table-cell">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-white/10 bg-white/[0.02] text-neutral-300">
                      {order.channel === 'pos' ? <Wallet className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                      {channelLabel(order.channel)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                      <CreditCard className="w-3 h-3" />
                      {order.paymentMethod || '—'}
                    </span>
                  </td>
                  <td className="table-cell font-mono font-bold text-blue-400">
                    {formatCurrency(order.total ?? order.totalAmount ?? 0)}
                  </td>
                  <td className="table-cell">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest', statusBadgeClass(order.status))}>
                      {order.status || 'completed'}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openDetail(order); }}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-blue-400 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t('orders.actions.view')}
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="sm:hidden divide-y divide-white/[0.05]">
          {filteredOrders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              className="p-4 space-y-3 active:bg-white/[0.02]"
              onClick={() => openDetail(order)}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-tighter">
                  NODE_#{order.id.slice(0, 8)}
                </span>
                <span className="text-[10px] font-bold text-neutral-600 uppercase">
                  {tsToDate(order.createdAt)
                    ? format(tsToDate(order.createdAt) as Date, 'MMM dd, HH:mm')
                    : t('orders.table.syncing')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-neutral-200">{order.customerName || '—'}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">
                    {channelLabel(order.channel)} · {order.paymentMethod || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-blue-400 text-base">{formatCurrency(order.total ?? order.totalAmount ?? 0)}</p>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.15em] mt-1 border', statusBadgeClass(order.status))}>
                    {order.status || 'completed'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {orders.length > 0 && filteredOrders.length === 0 && (
          <div className="py-16 text-center text-neutral-500 text-sm border-t border-white/[0.04] bg-white/[0.01]">
            {t('orders.filters.no_match')}
            <div className="mt-4">
              <button
                type="button"
                onClick={resetFilters}
                className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                {t('orders.filters.reset')}
              </button>
            </div>
          </div>
        )}

        {orders.length === 0 && (
          <div className="py-24 text-center">
            <div className="flex flex-col items-center gap-6 text-neutral-600 max-w-sm mx-auto p-6">
              <div className="w-20 h-20 rounded-3xl border border-dashed border-white/10 flex items-center justify-center bg-white/[0.01]">
                <Receipt className="w-10 h-10 opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-neutral-200">{t('orders.empty.title')}</p>
                <p className="text-xs leading-relaxed text-neutral-500 px-4">{t('orders.empty.subtitle')}</p>
              </div>
              <Button onClick={() => { handleCreateNew(); setError(null); }} className="gap-2 px-8 h-12 shadow-xl shadow-blue-600/20">
                <Plus className="w-4 h-4" /> {t('orders.empty.button')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Order detail modal */}
      <AnimatePresence>
        {detailOrder && (
          <OrderDetailModal
            order={detailOrder}
            items={detailItems}
            isLoadingItems={isLoadingItems}
            isDownloadingReceipt={isDownloadingReceipt}
            onClose={closeDetail}
            onDownloadReceipt={() => detailItems && handleDownloadReceipt(detailOrder, detailItems)}
          />
        )}
      </AnimatePresence>

      {/* Existing create modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-neutral-900 w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden shadow-black flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                <h2 className="font-display text-xl font-bold text-white uppercase tracking-tight">{t('orders.modal.title')}</h2>
                <button
                  type="button"
                  aria-label={t('common.close') || 'Close'}
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-8 space-y-10">
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-500">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-bold">{error}</p>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-2">
                      <Label>{t('orders.modal.customer')}</Label>
                      <select
                        required
                        aria-label={t('orders.modal.customer')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                        value={form.customerId}
                        onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                      >
                        <option value="" className="bg-neutral-900">{t('orders.modal.select_customer')}</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id} className="bg-neutral-900">
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('orders.modal.payment_method')}</Label>
                      <select
                        aria-label={t('orders.modal.payment_method')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                        value={form.paymentMethod}
                        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                      >
                        <option className="bg-neutral-900">Card</option>
                        <option className="bg-neutral-900">Cash</option>
                        <option className="bg-neutral-900">Transfer</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-white/[0.05] pb-2">
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">{t('orders.modal.components')}</Label>
                      <Button type="button" variant="ghost" className="h-7 text-[10px] gap-1 hover:bg-white/5 uppercase tracking-widest px-3 border border-white/10" onClick={addItem}>
                        <Plus className="w-3 h-3" /> {t('orders.modal.add_item')}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {form.items.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl">
                          <div className="flex-1 w-full">
                            <select
                              required
                              aria-label={t('orders.modal.select_asset')}
                              className="w-full bg-transparent border-0 text-sm text-white focus:ring-0 outline-none appearance-none"
                              value={item.productId}
                              onChange={(e) => updateItem(index, { productId: e.target.value })}
                            >
                              <option value="" className="bg-neutral-900">{t('orders.modal.select_asset')}</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id} className="bg-neutral-900">
                                  {p.name} (${p.price.toFixed(2)})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                            <div className="flex-1 sm:w-24">
                              <Input
                                type="number"
                                min="1"
                                required
                                className="h-10 bg-black/40 text-center"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                              />
                            </div>
                            <Button type="button" variant="ghost" className="w-10 h-10 p-0 text-neutral-600 hover:text-red-500 shrink-0" onClick={() => removeItem(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {form.items.length === 0 && (
                        <div className="py-12 text-center bg-white/[0.01] rounded-2xl border border-dashed border-white/10">
                          <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-700 italic">{t('orders.modal.empty_buffer')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/[0.05] space-y-8">
                    <div className="flex justify-between items-center px-2">
                      <div>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{t('orders.modal.total_valuation')}</p>
                        <span className="text-neutral-500 text-xs italic">{t('orders.modal.taxes_included')}</span>
                      </div>
                      <span className="text-4xl font-mono font-bold text-white tracking-tighter">
                        <span className="text-blue-500 mr-1">$</span>
                        {calculateTotal().toFixed(2)}
                      </span>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-14 text-sm font-bold uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-600/10">
                      {loading ? t('orders.modal.syncing') : t('orders.modal.commit')}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FilterOption {
  value: string;
  label: string;
}
function FilterChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-600 mr-1">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border',
            value === opt.value
              ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
              : 'border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:text-neutral-300 hover:border-white/10'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function OrderDetailModal({
  order,
  items,
  isLoadingItems,
  isDownloadingReceipt,
  onClose,
  onDownloadReceipt,
}: {
  order: Order;
  items: OrderSnapshotItem[] | null;
  isLoadingItems: boolean;
  isDownloadingReceipt: boolean;
  onClose: () => void;
  onDownloadReceipt: () => void;
}) {
  const { t, formatCurrency } = useLocale();

  const subtotal = order.subtotal ?? (items?.reduce((s, it) => s + it.price * it.quantity, 0) ?? 0);
  const discount = order.discount ?? 0;
  const tax = order.tax ?? 0;
  const total = order.total ?? order.totalAmount ?? toMoney(subtotal - discount + tax);
  const createdDate = tsToDate(order.createdAt);
  const channel = order.channel === 'pos' ? t('orders.filters.channel_pos') : t('orders.filters.channel_orders');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden shadow-black flex flex-col max-h-[92vh]"
      >
        <div className="p-6 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600 mb-1">{t('orders.detail.title')}</p>
            <h2 className="font-display text-lg font-bold text-white">
              NODE_#{order.id.slice(0, 8).toUpperCase()}
            </h2>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Meta grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetailMeta label={t('orders.detail.order_id')} value={order.id} mono />
            <DetailMeta
              label={t('orders.detail.date')}
              value={createdDate ? format(createdDate, 'MMM dd, yyyy HH:mm') : '—'}
            />
            <DetailMeta label={t('orders.detail.customer')} value={order.customerName || t('orders.guest')} />
            <DetailMeta label={t('orders.detail.payment_method')} value={order.paymentMethod || '—'} />
            <DetailMeta label={t('orders.detail.channel')} value={channel} />
            {order.cashSessionId && (
              <DetailMeta label={t('orders.detail.cash_session')} value={order.cashSessionId} mono />
            )}
          </div>

          {/* Items */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('orders.detail.items_label')}</p>
              <ListChecks className="w-4 h-4 text-neutral-500" />
            </div>
            {isLoadingItems ? (
              <div className="px-4 py-10 text-center text-xs text-neutral-500">{t('orders.detail.loading_items')}</div>
            ) : !items || items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-neutral-500">{t('orders.detail.no_items')}</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {items.map((it) => (
                  <div key={`${order.id}-${it.productId}`} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-bold truncate">{it.productName}</p>
                      <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-bold">
                        {(it.sku || 'NO_SKU')} · {t('orders.detail.item_qty', { count: it.quantity })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono text-white">{formatCurrency(it.price * it.quantity)}</p>
                      <p className="text-[10px] text-neutral-600">
                        {formatCurrency(it.price)} {t('orders.detail.item_each')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Totals */}
            <div className="px-4 py-4 border-t border-white/[0.05] bg-white/[0.02] space-y-1.5">
              <Row label={t('orders.detail.subtotal')} value={formatCurrency(subtotal)} />
              <Row label={t('orders.detail.discount')} value={`- ${formatCurrency(discount)}`} />
              <Row label={t('orders.detail.tax')} value={`+ ${formatCurrency(tax)}`} />
              <div className="pt-2 mt-2 border-t border-white/[0.05] flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-neutral-500 font-black">
                  {t('orders.detail.total')}
                </span>
                <span className="text-2xl font-mono text-white">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Refund placeholder */}
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-4 text-xs text-neutral-500 leading-relaxed flex items-start gap-3">
            <RotateCcw className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-neutral-400 mb-1">{t('orders.actions.refund')}</p>
              <p>{t('orders.detail.refund_notice')}</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/[0.05] bg-white/[0.02] flex flex-col sm:flex-row gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} className="px-6">
            {t('common.close') || 'Close'}
          </Button>
          <Button
            onClick={onDownloadReceipt}
            disabled={isDownloadingReceipt || !items || items.length === 0}
            className="px-6 gap-2"
          >
            <Download className="w-4 h-4" />
            {isDownloadingReceipt ? t('common.processing') : t('orders.actions.download_receipt')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetailMeta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-3 py-2.5">
      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-600 mb-1">{label}</p>
      <p className={cn('text-sm text-white truncate', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

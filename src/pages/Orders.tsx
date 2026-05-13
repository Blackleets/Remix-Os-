import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Label, cn } from '../components/Common';
import { Layers, Plus, Search, Receipt, CreditCard, ChevronRight, Trash2, AlertCircle, Download, Radar, Activity, Sparkles, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached, getCompanyUsage } from '../lib/plans';
import { exportToCSV } from '../lib/exportUtils';
import { createSaleTransaction } from '../services/sales';
import { getOrderTotal } from '../../shared/orders';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: any;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stockLevel: number;
}

export function Orders() {
  const { company } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'cancelled'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Card' | 'Cash' | 'Transfer'>('all');

  const { canEditOrders } = usePermissions();

  useEffect(() => {
    if (location.state?.action === 'create') {
      handleCreateNew();
      setError(null);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const [form, setForm] = useState({
    customerId: '',
    paymentMethod: 'Card',
    items: [] as OrderItem[],
  });

  const getMonthlyOrdersCount = () => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    return orders.filter((o) => {
      if (!o.createdAt) return false;
      const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return date >= start && date <= end;
    }).length;
  };

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
      if (isLimitReached(getMonthlyOrdersCount(), plan.limits.orders)) {
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

  const filteredOrders = orders.filter((order) => {
    const normalized = search.trim().toLowerCase();
    const searchMatch =
      normalized.length === 0 ||
      order.customerName?.toLowerCase().includes(normalized) ||
      order.id.toLowerCase().includes(normalized);
    const statusMatch = statusFilter === 'all' || order.status === statusFilter;
    const paymentMatch = paymentFilter === 'all' || order.paymentMethod === paymentFilter;
    return searchMatch && statusMatch && paymentMatch;
  });

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', productName: '', quantity: 1, price: 0 }],
    }));
  };

  const updateItem = (index: number, patch: Partial<OrderItem>) => {
    setForm((prev) => {
      const items = [...prev.items];
      const current = items[index];
      const next = { ...current, ...patch };

      if (patch.productId) {
        const selected = products.find((p) => p.id === patch.productId);
        next.productName = selected?.name || '';
        next.price = selected?.price || 0;
      }

      items[index] = next;
      return { ...prev, items };
    });
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateTotal = () => {
    return form.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setError(null);
    setLoading(true);
    try {
      const customer = customers.find((c) => c.id === form.customerId);
      if (!customer) throw new Error(t('orders.modal.select_customer'));
      if (form.items.length === 0) throw new Error(t('orders.modal.empty_buffer'));

      const preparedItems = form.items.map((item) => {
        const selected = products.find((p) => p.id === item.productId);
        if (!selected) throw new Error('A selected product no longer exists.');
        return {
          productId: selected.id,
          productName: selected.name,
          quantity: item.quantity,
          price: selected.price,
        };
      });

      await createSaleTransaction({
        companyId: company.id,
        customerId: customer.id,
        customerName: customer.name,
        items: preparedItems,
        paymentMethod: form.paymentMethod,
        subtotal: calculateTotal(),
        total: calculateTotal(),
      });

      setForm({ customerId: '', paymentMethod: 'Card', items: [] });
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to create transaction.');
    } finally {
      setLoading(false);
    }
  };

  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const totalVolume = filteredOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-emerald-400/16 bg-emerald-500/8 text-emerald-200';
      case 'pending':
        return 'border-amber-400/16 bg-amber-500/8 text-amber-200';
      case 'cancelled':
        return 'border-red-400/16 bg-red-500/8 text-red-200';
      default:
        return 'border-white/10 bg-white/[0.04] text-neutral-300';
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="hero-gradient overflow-hidden rounded-[30px] border border-white/10 p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="operator-badge">
                <span className="status-dot bg-blue-400 text-blue-400" />
                Transaction Flow
              </span>
              <span className="telemetry-chip">
                <Radar className="h-3 w-3 text-blue-300" />
                Revenue Queue
              </span>
            </div>
            <h1 className="section-title text-4xl md:text-5xl">{t('orders.title')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300 md:text-base">
              Monitor commercial throughput, filter execution states and open new transaction flows without leaving the operating layer.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="h-12 gap-2 px-6"
              onClick={() => exportToCSV(filteredOrders.map((o) => ({
                ID: o.id,
                Customer: o.customerName,
                Total: getOrderTotal(o),
                Status: o.status,
                Payment: o.paymentMethod,
                Date: o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toISOString() : o.createdAt,
              })), 'orders')}
              disabled={filteredOrders.length === 0}
            >
              <Download className="w-4 h-4" /> {t('common.export')}
            </Button>
            {canEditOrders && (
              <Button onClick={() => { handleCreateNew(); setError(null); }} className="h-12 gap-2 px-6">
                <Plus className="w-4 h-4" /> {t('orders.log_transaction')}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Completed Orders</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{completedCount}</p>
                <p className="mt-1 text-sm text-neutral-400">Transactions already finalized in the current ledger.</p>
              </div>
              <Sparkles className="h-5 w-5 text-emerald-300" />
            </div>
          </div>
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Pending Flow</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{pendingCount}</p>
                <p className="mt-1 text-sm text-neutral-400">Transactions awaiting final execution or cleanup.</p>
              </div>
              <Activity className="h-5 w-5 text-amber-300" />
            </div>
          </div>
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Filtered Volume</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">${totalVolume.toFixed(0)}</p>
                <p className="mt-1 text-sm text-neutral-400">Aggregate value for the current result set.</p>
              </div>
              <Wallet className="h-5 w-5 text-blue-300" />
            </div>
          </div>
        </div>
      </section>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={t('orders.upgrade.title') || 'Transaction Limit Reached'}
        message={t('orders.upgrade.message') || 'Monthly transaction throughput has peaked for your current plan. Synchronize to a higher tier to restore commercial flow.'}
        limitName={t('orders.limit_name') || 'Monthly Orders'}
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/[0.06] bg-white/[0.02] p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="section-kicker mb-2">Flow Filters</p>
              <h2 className="section-title text-2xl">{t('orders.table.id')}</h2>
              <p className="mt-2 text-sm text-neutral-400">Search by customer or order id, then narrow by execution state and payment rail.</p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
              <div className="relative group w-full lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 transition-colors group-focus-within:text-blue-500" />
                <Input
                  placeholder={t('orders.search_placeholder')}
                  className="h-12 border-white/10 bg-black/30 pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-xs font-bold uppercase tracking-[0.16em] text-white focus:outline-none"
                >
                  <option value="all" className="bg-neutral-900">{t('orders.filter')} / {t('common.all') || 'All'}</option>
                  <option value="completed" className="bg-neutral-900">Completed</option>
                  <option value="pending" className="bg-neutral-900">Pending</option>
                  <option value="cancelled" className="bg-neutral-900">Cancelled</option>
                </select>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
                  className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-xs font-bold uppercase tracking-[0.16em] text-white focus:outline-none"
                >
                  <option value="all" className="bg-neutral-900">{t('orders.table.modality')}</option>
                  <option value="Card" className="bg-neutral-900">{t('common.card') || 'Card'}</option>
                  <option value="Cash" className="bg-neutral-900">{t('common.cash') || 'Cash'}</option>
                  <option value="Transfer" className="bg-neutral-900">{t('common.transfer') || 'Transfer'}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden max-h-[700px] overflow-x-auto overflow-y-auto sm:block">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[rgba(6,10,16,0.92)] backdrop-blur-xl">
                <th className="table-header">{t('orders.table.id')}</th>
                <th className="table-header">{t('orders.table.timestamp')}</th>
                <th className="table-header">{t('orders.table.counterparty')}</th>
                <th className="table-header">{t('orders.table.total')}</th>
                <th className="table-header">{t('orders.table.status')}</th>
                <th className="table-header text-right">{t('orders.table.modality')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, i) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group cursor-pointer border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="table-cell">
                    <span className="font-mono text-[11px] uppercase tracking-tighter text-neutral-500">
                      NODE_#{order.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-[11px] font-bold uppercase text-neutral-500">
                      {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, HH:mm') : t('orders.table.pending')}
                    </span>
                  </td>
                  <td className="table-cell font-bold text-neutral-100">{order.customerName}</td>
                  <td className="table-cell font-mono font-bold text-blue-300">
                    ${getOrderTotal(order).toFixed(2)}
                  </td>
                  <td className="table-cell">
                    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', getStatusClasses(order.status))}>
                      {order.status}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-3 text-neutral-500 transition-colors group-hover:text-blue-300">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{order.paymentMethod}</span>
                      <ChevronRight className="ml-1 w-4 h-4 translate-x-[-4px] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-white/[0.05] sm:hidden">
          {filteredOrders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="space-y-3 p-4 active:bg-white/[0.02]"
              onClick={() => navigate('/customers')}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-tighter text-neutral-500">
                  NODE_#{order.id.slice(0, 8)}
                </span>
                <span className="text-[10px] font-bold uppercase text-neutral-600">
                  {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, HH:mm') : t('orders.table.syncing')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-neutral-200">{order.customerName}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-widest text-neutral-500">{order.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-bold text-blue-300">${getOrderTotal(order).toFixed(2)}</p>
                  <span className={cn('mt-1 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em]', getStatusClasses(order.status))}>
                    {order.status}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="py-24 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-6 p-6 text-neutral-600">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.01]">
                <Receipt className="w-10 h-10 opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-neutral-200">{t('orders.empty.title')}</p>
                <p className="px-4 text-xs leading-relaxed text-neutral-500">{t('orders.empty.subtitle')}</p>
              </div>
              <Button onClick={() => { handleCreateNew(); setError(null); }} className="h-12 gap-2 px-8">
                <Plus className="w-4 h-4" /> {t('orders.empty.button')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black"
            >
              <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.02] p-8">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white">{t('orders.modal.title')}</h2>
                <button onClick={() => setIsModalOpen(false)} className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-10 p-8">
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm font-bold">{error}</p>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                    <div className="space-y-2">
                      <Label>{t('orders.modal.customer')}</Label>
                      <select required className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:ring-2 focus:ring-blue-500/30" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                        <option value="" className="bg-neutral-900">{t('orders.modal.select_customer')}</option>
                        {customers.map((c) => <option key={c.id} value={c.id} className="bg-neutral-900">{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('orders.modal.payment_method')}</Label>
                      <select className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:ring-2 focus:ring-blue-500/30" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                        <option className="bg-neutral-900">{t('common.card') || 'Card'}</option>
                        <option className="bg-neutral-900">{t('common.cash') || 'Cash'}</option>
                        <option className="bg-neutral-900">{t('common.transfer') || 'Transfer'}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-end justify-between border-b border-white/[0.05] pb-2">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">{t('orders.modal.components')}</Label>
                      <Button type="button" variant="ghost" className="h-7 gap-1 border border-white/10 px-3 text-[10px] uppercase tracking-widest hover:bg-white/5" onClick={addItem}>
                        <Plus className="w-3 h-3" /> {t('orders.modal.add_item')}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {form.items.map((item, index) => (
                        <div key={index} className="flex flex-col items-start gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
                          <div className="w-full flex-1">
                            <select
                              required
                              className="w-full appearance-none border-0 bg-transparent text-sm text-white outline-none focus:ring-0"
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
                          <div className="mt-2 flex w-full items-center gap-4 sm:mt-0 sm:w-auto">
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
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 w-10 shrink-0 p-0 text-neutral-600 hover:text-red-500"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {form.items.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-12 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest italic text-neutral-700">
                            {t('orders.modal.empty_buffer')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8 border-t border-white/[0.05] pt-8">
                    <div className="flex items-center justify-between px-2">
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t('orders.modal.total_valuation')}</p>
                        <span className="text-xs italic text-neutral-500">{t('orders.modal.taxes_included')}</span>
                      </div>
                      <span className="font-mono text-4xl font-bold tracking-tighter text-white">
                        ${calculateTotal().toFixed(2)}
                      </span>
                    </div>
                    <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl text-sm font-bold uppercase tracking-[0.2em]">
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

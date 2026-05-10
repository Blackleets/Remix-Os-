import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/Common';
import {
  Contact,
  Shapes,
  Layers,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Receipt,
  UserPlus,
  Database,
  History,
  Download,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Zap,
  Activity,
  AlertTriangle,
  Wallet,
  Package,
  DollarSign,
  Calendar,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, limit, orderBy, Timestamp, onSnapshot, getDocs } from 'firebase/firestore';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { exportDashboardToPDF } from '../lib/exportUtils';
import { cn } from '../components/Common';
import { useLocale } from '../hooks/useLocale';
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';
import { bucketByDay, getDateRanges } from '../lib/dateMetrics';
import { sumBy, toMoney } from '../lib/moneyUtils';

interface ActivityItem {
  id: string;
  type: 'order' | 'customer' | 'product' | 'movement' | string;
  title: string;
  subtitle: string;
  createdAt: Timestamp;
}

type RangeKey = '7d' | '30d';

const PAYMENT_COLORS: Record<string, string> = {
  Cash: '#10b981',
  Card: '#3b82f6',
  Transfer: '#8b5cf6',
  Crypto: '#f59e0b',
  Stripe: '#ef4444',
};

export function Dashboard() {
  const { company } = useAuth();
  const { t, formatCurrency } = useLocale();
  const navigate = useNavigate();

  const metrics = useBusinessMetrics({
    include: ['sales', 'pos', 'inventory', 'customers', 'products'],
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [revenueRange, setRevenueRange] = useState<RangeKey>('7d');

  // Activities are not part of useBusinessMetrics — keep their own subscription.
  useEffect(() => {
    if (!company?.id) return;
    const activityQ = query(
      collection(db, 'activities'),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc'),
      limit(8)
    );
    const unsubscribe = onSnapshot(
      activityQ,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          type: (d.data().type as string)?.split('_')[0] || 'order',
          title: d.data().title,
          subtitle: d.data().subtitle,
          createdAt: d.data().createdAt,
        }));
        setActivities(list as ActivityItem[]);
      },
      (error) => {
        console.error('Dashboard activities listener error:', error);
      }
    );
    return unsubscribe;
  }, [company?.id]);

  const sales = metrics.sales;
  const pos = metrics.pos;
  const inventory = metrics.inventory;
  const customerMetrics = metrics.customers;
  const productMetrics = metrics.products;
  const orders = metrics.raw.orders;

  const revenueChartData = useMemo(() => {
    const ranges = getDateRanges();
    const range = revenueRange === '7d' ? ranges.last7Days : ranges.last30Days;
    const completed = orders.filter((o) => !o.status || o.status === 'completed');
    const buckets = bucketByDay(completed, (o) => o.createdAt, range);
    return Array.from(buckets.entries()).map(([key, items]) => ({
      key,
      name: format(new Date(key), revenueRange === '7d' ? 'EEE' : 'MMM d'),
      revenue: sumBy(items, (o) => o.total ?? o.totalAmount ?? 0),
      orders: items.length,
    }));
  }, [orders, revenueRange]);

  const paymentMixData = useMemo(() => {
    if (!pos) return [];
    return [
      { name: 'Cash', value: pos.cashRevenue },
      { name: 'Card', value: pos.cardRevenue },
      { name: 'Transfer', value: pos.transferRevenue },
      { name: 'Crypto', value: pos.cryptoRevenue },
      { name: 'Stripe', value: pos.stripeRevenue },
    ].filter((entry) => entry.value > 0);
  }, [pos]);

  const topProductsData = useMemo(() => {
    if (!productMetrics) return [];
    return productMetrics.highestRevenueProducts
      .filter((row) => row.revenue > 0)
      .slice(0, 5)
      .map((row) => ({
        name: (row.product.name || '—').slice(0, 22),
        revenue: row.revenue,
      }));
  }, [productMetrics]);

  const lowStockList = useMemo(() => {
    if (!inventory) return [];
    return [...inventory.outOfStockProducts, ...inventory.lowStockProducts].slice(0, 6);
  }, [inventory]);

  const showChecklist =
    !metrics.isLoading &&
    ((productMetrics && productMetrics.bestSellingProducts.length === 0) ||
      (customerMetrics && customerMetrics.totalCustomers === 0) ||
      (sales && sales.totalOrders === 0));

  const handleExportPDF = async () => {
    if (!company || !sales || !inventory || !customerMetrics) return;
    setExporting(true);
    try {
      const [recentOrdersSnap, productsSnap] = await Promise.all([
        getDocs(query(collection(db, 'orders'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(10))),
        getDocs(query(collection(db, 'products'), where('companyId', '==', company.id), orderBy('stockLevel', 'asc'), limit(10))),
      ]);

      const modules = [
        {
          title: 'Core Metrics',
          data: [
            { Metric: 'Revenue (today)', Value: formatCurrency(sales.revenueToday) },
            { Metric: 'Revenue (week)', Value: formatCurrency(sales.revenueThisWeek) },
            { Metric: 'Revenue (month)', Value: formatCurrency(sales.revenueThisMonth) },
            { Metric: 'Average ticket', Value: formatCurrency(sales.averageOrderValue) },
            { Metric: 'Total orders', Value: sales.totalOrders.toString() },
            { Metric: 'Active customers', Value: customerMetrics.activeCustomers.toString() },
            { Metric: 'Stock units', Value: inventory.totalStockUnits.toString() },
            { Metric: 'Estimated margin', Value: formatCurrency(inventory.estimatedGrossMargin) },
          ],
          columns: ['Metric', 'Value'],
        },
        {
          title: 'Recent Transactions',
          data: recentOrdersSnap.docs.map((d) => ({
            ID: d.id.slice(-6).toUpperCase(),
            Customer: d.data().customerName,
            Total: `$${(d.data().total ?? d.data().totalAmount ?? 0).toFixed(2)}`,
            Status: d.data().status,
            Date: d.data().createdAt,
          })),
          columns: ['ID', 'Customer', 'Total', 'Status', 'Date'],
        },
        {
          title: 'Inventory Alert (Lowest Stock)',
          data: productsSnap.docs.map((d) => ({
            Name: d.data().name,
            SKU: d.data().sku,
            Stock: d.data().stockLevel,
            Status: d.data().status,
          })),
          columns: ['Name', 'SKU', 'Stock', 'Status'],
        },
      ];

      exportDashboardToPDF(company.name, modules);
    } catch (err) {
      console.error('PDF Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order': return <Receipt className="w-4 h-4 text-blue-600" />;
      case 'customer': return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'product': return <Database className="w-4 h-4 text-amber-600" />;
      case 'movement': return <History className="w-4 h-4 text-purple-600" />;
      case 'pos': return <Wallet className="w-4 h-4 text-emerald-500" />;
      case 'cash': return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'ai':
      case 'ai_sync': return <Cpu className="w-4 h-4 text-blue-400" />;
      default: return <Plus className="w-4 h-4" />;
    }
  };

  const getRelativeTime = (timestamp: Timestamp) => {
    if (!timestamp) return '...';
    const now = new Date();
    const date = timestamp.toDate?.() || new Date(timestamp as any);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return t('common.now') || 'now';
    if (diffMins < 60) return `${diffMins}m ${t('common.ago') || 'ago'}`;
    if (diffHours < 24) return `${diffHours}h ${t('common.ago') || 'ago'}`;
    return `${diffDays}d ${t('common.ago') || 'ago'}`;
  };

  if (metrics.isLoading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="space-y-6 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-2 border-white/10 border-t-blue-500 rounded-full mx-auto"
          />
          <div className="space-y-2">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white">{t('common.loading')}</p>
            <p className="text-xs text-neutral-500 font-mono italic">{t('common.syncing')}</p>
          </div>
        </div>
      </div>
    );
  }

  const renderGrowthBadge = (pct: number | null) => {
    if (pct == null) {
      return (
        <div className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-neutral-500">
          {t('dashboard.tiles.no_baseline')}
        </div>
      );
    }
    const positive = pct >= 0;
    return (
      <div
        className={cn(
          'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border flex items-center gap-1',
          positive
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        )}
      >
        {positive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
        {positive ? '+' : ''}
        {pct.toFixed(1)}%
      </div>
    );
  };

  const tilesPrimary = [
    {
      label: t('dashboard.tiles.revenue_today'),
      value: formatCurrency(sales?.revenueToday || 0),
      icon: Calendar,
      color: 'text-blue-400',
      growth: undefined as number | null | undefined,
    },
    {
      label: t('dashboard.tiles.revenue_week'),
      value: formatCurrency(sales?.revenueThisWeek || 0),
      icon: TrendingUp,
      color: 'text-emerald-400',
      growth: undefined,
    },
    {
      label: t('dashboard.tiles.revenue_month'),
      value: formatCurrency(sales?.revenueThisMonth || 0),
      icon: DollarSign,
      color: 'text-purple-400',
      growth: sales?.revenueGrowthPercent ?? null,
    },
    {
      label: t('dashboard.tiles.average_order_value'),
      value: formatCurrency(sales?.averageOrderValue || 0),
      icon: Receipt,
      color: 'text-amber-400',
      growth: undefined,
    },
  ];

  const tilesSecondary = [
    {
      label: t('dashboard.tiles.total_orders'),
      value: (sales?.totalOrders || 0).toString(),
      icon: Layers,
      color: 'text-orange-400',
      growth: sales?.orderGrowthPercent ?? null,
    },
    {
      label: t('dashboard.tiles.active_customers'),
      value: (customerMetrics?.activeCustomers || 0).toString(),
      icon: Contact,
      color: 'text-purple-400',
      growth: undefined as number | null | undefined,
    },
    {
      label: t('dashboard.tiles.total_stock'),
      value: (inventory?.totalStockUnits || 0).toString(),
      icon: Shapes,
      color: 'text-emerald-400',
      growth: undefined,
    },
    {
      label: t('dashboard.tiles.estimated_margin'),
      value: formatCurrency(inventory?.estimatedGrossMargin || 0),
      icon: TrendingUp,
      color: 'text-blue-400',
      growth: undefined,
    },
  ];

  const renderTile = (
    tile: { label: string; value: string; icon: any; color: string; growth: number | null | undefined },
    index: number
  ) => (
    <motion.div
      key={tile.label}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="group hover:bg-white/[0.03] p-6 h-full relative overflow-hidden transition-all duration-500">
        <div className="flex justify-between items-start mb-4">
          <div className={cn('w-10 h-10 bg-white/[0.03] rounded-xl flex items-center justify-center border border-white/[0.05]', tile.color)}>
            <tile.icon className="w-5 h-5" />
          </div>
          {tile.growth !== undefined && renderGrowthBadge(tile.growth)}
        </div>
        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{tile.label}</p>
        <h3 className="text-2xl font-bold tracking-tight text-white">{tile.value}</h3>
        {tile.growth != null && (
          <p className="mt-1 text-[9px] uppercase tracking-widest text-neutral-600 font-bold">
            {t('dashboard.tiles.vs_prev_period')}
          </p>
        )}
      </Card>
    </motion.div>
  );

  const chartHasData = revenueChartData.some((d) => d.revenue > 0);
  const ordersChartHasData = revenueChartData.some((d) => d.orders > 0);
  const paymentsHasData = paymentMixData.length > 0;
  const topProductsHasData = topProductsData.length > 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2">{t('dashboard.title')}</h1>
          <p className="text-neutral-500 text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            {t('dashboard.status', { name: company?.name })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Button
            variant="secondary"
            className="px-6 gap-2 justify-center"
            onClick={handleExportPDF}
            disabled={exporting}
          >
            {exporting ? <History className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? t('dashboard.generating') : t('dashboard.download_report')}
          </Button>
          <Button className="px-6 flex gap-2 justify-center" onClick={() => navigate('/orders', { state: { action: 'create' } })}>
            <Plus className="w-4 h-4" /> {t('dashboard.new_order')}
          </Button>
        </div>
      </div>

      {showChecklist && productMetrics && customerMetrics && sales && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
          <Card className="bg-blue-500/[0.02] border-blue-500/20 p-8 rounded-3xl">
            <div className="flex flex-col lg:flex-row gap-10 items-center">
              <div className="lg:w-1/3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{t('dashboard.setup.subtitle')}</span>
                </div>
                <h2 className="text-2xl font-bold mb-4">{t('dashboard.setup.title')}</h2>
                <p className="text-sm text-neutral-500 leading-relaxed">{t('dashboard.setup.description')}</p>
              </div>

              <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
                {[
                  {
                    label: t('dashboard.setup.register_product'),
                    desc: t('dashboard.setup.register_product_desc'),
                    done: productMetrics.bestSellingProducts.length > 0 || metrics.raw.products.length > 0,
                    link: '/products',
                    icon: <Database className="w-5 h-5" />,
                  },
                  {
                    label: t('dashboard.setup.add_customer'),
                    desc: t('dashboard.setup.add_customer_desc'),
                    done: customerMetrics.totalCustomers > 0,
                    link: '/customers',
                    icon: <UserPlus className="w-5 h-5" />,
                  },
                  {
                    label: t('dashboard.setup.log_sale'),
                    desc: t('dashboard.setup.log_sale_desc'),
                    done: sales.totalOrders > 0,
                    link: '/orders',
                    icon: <Receipt className="w-5 h-5" />,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={() => navigate(item.link, { state: { action: 'create' } })}
                    className={cn(
                      'group relative p-5 rounded-2xl border transition-all cursor-pointer',
                      item.done ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.03] border-white/[0.05] hover:border-blue-500/30'
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center border transition-colors',
                          item.done ? 'border-emerald-500/20 text-emerald-500' : 'border-white/10 text-neutral-500 group-hover:text-blue-500'
                        )}
                      >
                        {item.done ? <CheckCircle2 className="w-5 h-5" /> : item.icon}
                      </div>
                      <ChevronRight className={cn('w-4 h-4', item.done ? 'text-emerald-500/50' : 'text-neutral-700')} />
                    </div>
                    <h3 className={cn('font-bold text-sm mb-1', item.done ? 'text-emerald-500' : 'text-neutral-200')}>{item.label}</h3>
                    <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Primary tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tilesPrimary.map(renderTile)}
          </div>

          {/* Secondary tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tilesSecondary.map((tile, i) => renderTile(tile, i + tilesPrimary.length))}
          </div>

          {/* Revenue + Orders charts */}
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="relative overflow-hidden p-6">
              <div className="flex justify-between items-start mb-6 gap-4">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl tracking-tight">{t('dashboard.charts.revenue_title')}</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{t('dashboard.charts.revenue_subtitle')}</p>
                </div>
                <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                  {(['7d', '30d'] as RangeKey[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRevenueRange(opt)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all',
                        revenueRange === opt ? 'bg-blue-500/20 text-blue-300' : 'text-neutral-500 hover:text-neutral-300'
                      )}
                    >
                      {t(`dashboard.charts.range_${opt}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[260px] -mx-2">
                {chartHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#666', fontWeight: 600 }}
                        dy={10}
                        interval={revenueRange === '30d' ? 4 : 0}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0A0A0A',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => [formatCurrency(toMoney(Number(value))), t('dashboard.tiles.revenue_today').split(' ')[0]]}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </Card>

            <Card className="relative overflow-hidden p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl tracking-tight">{t('dashboard.charts.orders_title')}</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{t('dashboard.charts.orders_subtitle')}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="h-[260px] -mx-2">
                {ordersChartHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#666', fontWeight: 600 }}
                        dy={10}
                        interval={revenueRange === '30d' ? 4 : 0}
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
                      <Bar dataKey="orders" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </Card>
          </div>

          {/* Payment mix + Top products */}
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl tracking-tight">{t('dashboard.charts.payment_methods_title')}</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{t('dashboard.charts.payment_methods_subtitle')}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="h-[240px] -mx-2">
                {paymentsHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentMixData} layout="vertical" margin={{ left: 16, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#999', fontWeight: 600 }}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0A0A0A',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => [formatCurrency(toMoney(Number(value))), '']}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {paymentMixData.map((entry) => (
                          <Cell key={entry.name} fill={PAYMENT_COLORS[entry.name] || '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl tracking-tight">{t('dashboard.charts.top_products_title')}</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{t('dashboard.charts.top_products_subtitle')}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="h-[240px] -mx-2">
                {topProductsHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsData} layout="vertical" margin={{ left: 16, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#999', fontWeight: 600 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0A0A0A',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => [formatCurrency(toMoney(Number(value))), '']}
                      />
                      <Bar dataKey="revenue" fill="#a855f7" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </Card>
          </div>

          {/* Activity feed (preserved) */}
          <Card className="flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h3 className="font-display font-bold text-xl tracking-tight">{t('dashboard.system_log')}</h3>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{t('dashboard.live_activity')}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <History className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[300px] scrollbar-hide pr-2">
              {activities.length === 0 ? (
                <div className="h-[180px] flex flex-col items-center justify-center text-neutral-600 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                  <History className="w-8 h-8 mb-4 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest italic">Activity_Stream_Empty</p>
                </div>
              ) : (
                activities.map((item) => (
                  <div key={item.id} className="flex gap-4 items-start pb-4 border-b border-white/[0.02] last:border-0 group cursor-pointer hover:bg-white/[0.01]">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-shrink-0 flex items-center justify-center mt-0.5 group-hover:border-blue-500/30 transition-colors">
                      {getActivityIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 mb-0.5">
                        <p className="text-xs font-bold text-neutral-200 truncate">{item.title}</p>
                        <span className="text-[9px] font-mono text-neutral-600 whitespace-nowrap">{getRelativeTime(item.createdAt)}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 truncate">{item.subtitle}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-8">
          <Card className="p-8 bg-blue-600/5 border-blue-500/20 relative overflow-hidden group shadow-[0_20px_50px_rgba(59,130,246,0.05)]">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
              <Cpu className="w-24 h-24" />
            </div>

            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">{t('dashboard.business_briefing')}</h3>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{t('dashboard.system_status')}</p>
                  <p className="text-[10px] font-mono font-bold text-emerald-500 tracking-tighter">{t('dashboard.ops_status.secure')}</p>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: '0%' }} animate={{ width: '98%' }} className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                </div>
              </div>

              <p className="text-sm text-neutral-400 leading-relaxed font-medium">
                {t('dashboard.briefing.operating_at')} <b>{t('dashboard.briefing.normal_capacity')}</b>. {t('dashboard.briefing.insights_indicate')}{' '}
                <b>{t('dashboard.briefing.stable_performance')}</b> {t('dashboard.briefing.with')} {formatCurrency(sales?.totalRevenue || 0)}{' '}
                {t('dashboard.briefing.in_revenue')}
              </p>

              <Button
                onClick={() => window.dispatchEvent(new CustomEvent('open-copilot'))}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] relative group/brief overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {t('dashboard.view_assistant')} <ArrowUpRight className="w-4 h-4" />
                </span>
              </Button>
            </div>
          </Card>

          {/* Low stock alert */}
          <Card className="p-6 bg-neutral-900 border-white/5">
            <div className="flex justify-between items-center mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600 mb-1">{t('dashboard.low_stock.subtitle')}</p>
                <h3 className="font-display font-bold text-base text-white">{t('dashboard.low_stock.title')}</h3>
              </div>
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', lowStockList.length > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400')}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            {lowStockList.length === 0 ? (
              <p className="text-xs text-neutral-500 leading-relaxed">{t('dashboard.low_stock.empty')}</p>
            ) : (
              <div className="space-y-2">
                {lowStockList.map((product) => {
                  const stock = product.stockLevel ?? 0;
                  const isOut = stock <= 0;
                  return (
                    <div
                      key={product.id}
                      onClick={() => navigate('/inventory')}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-200 truncate">{product.name || '—'}</p>
                        <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider truncate">{product.sku || 'NO_SKU'}</p>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-mono font-bold px-2 py-1 rounded-lg whitespace-nowrap',
                          isOut ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        )}
                      >
                        {isOut ? t('dashboard.low_stock.out') : t('dashboard.low_stock.remaining', { count: stock })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Ops status (preserved, fed by real metrics) */}
          <Card className="p-6 bg-neutral-900 border-white/5">
            <h3 className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-6">{t('dashboard.ops_status.title')}</h3>
            <div className="space-y-4">
              {[
                {
                  label: t('dashboard.ops_status.inventory'),
                  status: (inventory?.totalStockUnits || 0) > 0 ? t('dashboard.ops_status.optimal') : t('dashboard.ops_status.pending'),
                  icon: Shapes,
                },
                {
                  label: t('dashboard.ops_status.orders'),
                  status: (sales?.totalOrders || 0) > 0 ? t('dashboard.ops_status.nominal') : t('dashboard.ops_status.idle'),
                  icon: Receipt,
                },
                {
                  label: t('dashboard.ops_status.customers'),
                  status: (customerMetrics?.totalCustomers || 0) > 0 ? t('dashboard.ops_status.synced') : t('dashboard.ops_status.pending'),
                  icon: Contact,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] group hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-3.5 h-3.5 text-neutral-600 group-hover:text-blue-500 transition-colors" />
                    <span className="text-[11px] font-bold text-neutral-400 tracking-tight">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-blue-500 uppercase tracking-tighter">{item.status}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  const { t } = useLocale();
  return (
    <div className="h-full flex flex-col items-center justify-center text-neutral-600 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
      <Activity className="w-8 h-8 mb-4 opacity-20" />
      <p className="text-xs font-bold uppercase tracking-widest italic max-w-[260px] text-center">
        {t('dashboard.charts.empty')}
      </p>
    </div>
  );
}

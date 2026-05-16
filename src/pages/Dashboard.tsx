import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, cn } from '../components/Common';
import {
  Contact,
  Shapes,
  Layers,
  TrendingUp,
  ArrowUpRight,
  Download,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Zap,
  Activity,
  Fingerprint,
  Receipt,
  FileText,
  UserPlus,
  Database,
  History,
  Plus,
  Sparkles,
  AlertTriangle,
  Target,
  Pencil,
  Check,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, limit, orderBy, Timestamp, onSnapshot, getDocs } from 'firebase/firestore';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import { format, subDays, startOfDay, eachDayOfInterval, isSameDay } from 'date-fns';
import { exportDashboardToPDF } from '../lib/exportUtils';
import { useLocale } from '../hooks/useLocale';
import { getOrderTotal } from '../../shared/orders';

interface ActivityItem {
  id: string;
  type: 'order' | 'customer' | 'product' | 'movement';
  title: string;
  subtitle: string;
  createdAt: Timestamp;
}

type ActivityTone = 'signal' | 'client' | 'inventory' | 'ops';

function formatChangeValue(value: string) {
  return value === 'â€”' || value === '—' || value === '-' || value === '' ? 'Estable' : value;
}

export function Dashboard() {
  const { company } = useAuth();
  const { t, formatCurrency } = useLocale();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    customers: 0,
    products: 0,
    orders: 0,
    revenue: 0,
    revenueChange: '-',
  });
  const [chartData, setChartData] = useState<{ name: string; sales: number }[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<{ id: string; name: string; stockLevel: number; daysLeft: number | null; velocity: number }[]>([]);
  const [invoiceMetrics, setInvoiceMetrics] = useState({
    unpaidTotal: 0,
    overdueCount: 0,
    invoicesCount: 0,
  });
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    const stored = localStorage.getItem(`remix_daily_goal_${window.location.hostname}`);
    return stored ? Number(stored) : 0;
  });
  const [isGoalEditing, setIsGoalEditing] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  useEffect(() => {
    if (!company) return;

    setLoading(true);

    const ordersQ = query(
      collection(db, 'orders'),
      where('companyId', '==', company.id),
      where('status', '==', 'completed')
    );

    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      let totalRev = 0;
      let revenueThisWeek = 0;
      let revenuePrevWeek = 0;
      const now = new Date();
      const sevenDaysAgo = subDays(startOfDay(now), 6);
      const fourteenDaysAgo = subDays(startOfDay(now), 13);

      snapshot.forEach((doc) => {
        const total = getOrderTotal(doc.data());
        totalRev += total;
        const date = doc.data().createdAt?.toDate?.();
        if (date) {
          if (date >= sevenDaysAgo) revenueThisWeek += total;
          else if (date >= fourteenDaysAgo) revenuePrevWeek += total;
        }
      });

      let revenueChange = '—';
      if (revenuePrevWeek > 0) {
        const pct = ((revenueThisWeek - revenuePrevWeek) / revenuePrevWeek) * 100;
        revenueChange = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      } else if (revenueThisWeek > 0) {
        revenueChange = 'NEW';
      }

      setStats((prev) => ({
        ...prev,
        orders: snapshot.size,
        revenue: totalRev,
        revenueChange,
      }));

      const days = eachDayOfInterval({ start: sevenDaysAgo, end: now });
      const dayWiseSales = days.map((day) => {
        const salesForDay = snapshot.docs
          .filter((entry) => {
            const date = entry.data().createdAt?.toDate();
            return date && isSameDay(date, day);
          })
          .reduce((sum, entry) => sum + getOrderTotal(entry.data()), 0);

        return {
          name: format(day, 'EEE'),
          sales: salesForDay,
        };
      });
      setChartData(dayWiseSales);
    }, (error) => {
      console.error('Dashboard orders listener error:', error);
      setLoading(false);
    });

    const customersQ = query(collection(db, 'customers'), where('companyId', '==', company.id));
    const unsubscribeCustomers = onSnapshot(customersQ, (snapshot) => {
      setStats((prev) => ({ ...prev, customers: snapshot.size }));
    }, (error) => {
      console.error('Dashboard customers listener error:', error);
    });

    const productsQ = query(collection(db, 'products'), where('companyId', '==', company.id));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      setStats((prev) => ({ ...prev, products: snapshot.size }));
      setLoading(false);
    }, (error) => {
      console.error('Dashboard products listener error:', error);
      setLoading(false);
    });

    const activityQ = query(
      collection(db, 'activities'),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc'),
      limit(8)
    );
    const unsubscribeActivity = onSnapshot(activityQ, (snapshot) => {
      const activityList = snapshot.docs.map((d) => ({
        id: d.id,
        type: d.data().type?.split('_')[0] || 'order',
        title: d.data().title,
        subtitle: d.data().subtitle,
        createdAt: d.data().createdAt,
      }));
      setActivities(activityList as ActivityItem[]);
    }, (error) => {
      console.error('Dashboard activities listener error:', error);
    });

    // Invoice metrics for the Dashboard "Facturación" tile. Tolerant to
    // companies that never created invoices — the listener is best-effort.
    const invoicesQ = query(collection(db, 'invoices'), where('companyId', '==', company.id));
    const unsubscribeInvoices = onSnapshot(
      invoicesQ,
      (snapshot) => {
        let unpaidTotal = 0;
        let overdueCount = 0;
        let invoicesCount = 0;
        snapshot.forEach((d) => {
          const data = d.data() as any;
          if (data?.status === 'cancelled') return;
          invoicesCount += 1;
          if (data?.status === 'issued' || data?.status === 'sent' || data?.status === 'overdue') {
            const due = Number(data?.amountDue);
            const total = Number(data?.total) || 0;
            unpaidTotal += Number.isFinite(due) ? due : total;
          }
          if (data?.status === 'overdue') overdueCount += 1;
        });
        setInvoiceMetrics({ unpaidTotal, overdueCount, invoicesCount });
      },
      (error) => {
        console.error('Dashboard invoices listener error:', error);
      }
    );

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
      unsubscribeProducts();
      unsubscribeActivity();
      unsubscribeInvoices();
    };
  }, [company]);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;

    async function computeStockAlerts() {
      const LOOKBACK_DAYS = 14;
      const cutoff = subDays(new Date(), LOOKBACK_DAYS);

      const [productsSnap, ordersSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('companyId', '==', company!.id), where('status', '==', 'active'))),
        getDocs(query(collection(db, 'orders'), where('companyId', '==', company!.id), where('status', '==', 'completed'))),
      ]);

      if (cancelled) return;

      // Count units sold per product in last 14 days
      const unitsSold = new Map<string, number>();
      ordersSnap.docs.forEach(d => {
        const createdAt = d.data().createdAt?.toDate?.();
        if (!createdAt || createdAt < cutoff) return;
        const items: { productId: string; quantity: number }[] = d.data().itemsSnapshot || [];
        items.forEach(item => {
          unitsSold.set(item.productId, (unitsSold.get(item.productId) || 0) + item.quantity);
        });
      });

      const alerts = productsSnap.docs
        .map(d => {
          const stockLevel = d.data().stockLevel ?? 0;
          const sold = unitsSold.get(d.id) || 0;
          const velocity = sold / LOOKBACK_DAYS; // units/day
          const daysLeft = velocity > 0 ? Math.floor(stockLevel / velocity) : null;
          return { id: d.id, name: d.data().name, stockLevel, daysLeft, velocity };
        })
        .filter(p => p.stockLevel >= 0 && (p.stockLevel <= 5 || (p.daysLeft !== null && p.daysLeft <= 14)))
        .sort((a, b) => {
          if (a.daysLeft === null && b.daysLeft === null) return a.stockLevel - b.stockLevel;
          if (a.daysLeft === null) return 1;
          if (b.daysLeft === null) return -1;
          return a.daysLeft - b.daysLeft;
        })
        .slice(0, 6);

      setStockAlerts(alerts);
    }

    computeStockAlerts().catch(console.error);
    return () => { cancelled = true; };
  }, [company]);

  const showChecklist = stats.products === 0 || stats.customers === 0 || stats.orders === 0;
  const allSystemsReady = stats.products > 0 && stats.customers > 0 && stats.orders > 0;

  const activityMeta = useMemo(() => {
    return activities.map((item) => {
      const type = item.type;
      let tone: ActivityTone = 'ops';
      let chip = 'Operación';
      let icon = <History className="h-4 w-4 text-neutral-300" />;
      let accent = 'from-white/10 to-transparent border-white/12';

      if (type === 'order') {
        tone = 'signal';
        chip = 'Señal comercial';
        icon = <Receipt className="h-4 w-4 text-blue-300" />;
        accent = 'from-blue-500/14 to-transparent border-blue-400/14';
      } else if (type === 'customer') {
        tone = 'client';
        chip = 'Movimiento cliente';
        icon = <UserPlus className="h-4 w-4 text-emerald-300" />;
        accent = 'from-emerald-500/14 to-transparent border-emerald-400/14';
      } else if (type === 'product') {
        tone = 'inventory';
        chip = 'Pulso inventario';
        icon = <Database className="h-4 w-4 text-amber-300" />;
        accent = 'from-amber-500/14 to-transparent border-amber-400/14';
      }

      return { ...item, tone, chip, icon, accent };
    });
  }, [activities]);

  const operatingBrief = useMemo(() => {
    if (!stats.orders && !stats.customers && !stats.products) {
      return 'Remix OS está en espera. Completa la secuencia de activación para desbloquear inteligencia operativa en vivo.';
    }
    if (stats.orders > 0 && stats.revenue > 0) {
      return `Los ingresos en vivo se sitúan en ${formatCurrency(stats.revenue)} con ${stats.orders} transacciones ejecutadas en la ventana operativa actual.`;
    }
    if (stats.products > 0 || stats.customers > 0) {
      return `El grafo comercial está en línea con ${stats.products} nodos de producto y ${stats.customers} registros de clientes. El sistema está listo para operar.`;
    }
    return 'Los datos operativos se están sincronizando en todo el espacio de trabajo.';
  }, [formatCurrency, stats]);

  const todayRevenue = chartData.length > 0 ? (chartData[chartData.length - 1]?.sales ?? 0) : 0;
  const goalProgress = dailyGoal > 0 ? Math.min(100, (todayRevenue / dailyGoal) * 100) : 0;
  const goalMet = dailyGoal > 0 && todayRevenue >= dailyGoal;

  const saveGoal = () => {
    const val = Math.max(0, parseFloat(goalInput) || 0);
    setDailyGoal(val);
    localStorage.setItem(`remix_daily_goal_${window.location.hostname}`, String(val));
    setIsGoalEditing(false);
  };

  const handleExportPDF = async () => {
    if (!company) return;
    setExporting(true);
    try {
      const [recentOrdersSnap, productsSnap] = await Promise.all([
        getDocs(query(collection(db, 'orders'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(10))),
        getDocs(query(collection(db, 'products'), where('companyId', '==', company.id), orderBy('stockLevel', 'asc'), limit(10))),
      ]);

      const modules = [
        {
          title: 'Métricas centrales',
          data: [
            { Metric: 'Ingresos totales', Value: formatCurrency(stats.revenue) },
            { Metric: 'Clientes activos', Value: stats.customers.toString() },
            { Metric: 'Tipos de activo', Value: stats.products.toString() },
            { Metric: 'Transacciones totales', Value: stats.orders.toString() },
          ],
          columns: ['Metric', 'Value'],
        },
        {
          title: 'Transacciones recientes',
          data: recentOrdersSnap.docs.map((d) => ({
            ID: d.id.slice(-6).toUpperCase(),
            Customer: d.data().customerName,
            Total: `${getOrderTotal(d.data()).toFixed(2)}`,
            Status: d.data().status,
            Date: d.data().createdAt,
          })),
          columns: ['ID', 'Customer', 'Total', 'Status', 'Date'],
        },
        {
          title: 'Alerta de inventario',
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

  const getRelativeTime = (timestamp: Timestamp) => {
    if (!timestamp) return '...';
    const now = new Date();
    const date = timestamp.toDate();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return `Hace ${diffDays} d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="shell-panel min-w-[280px] px-8 py-10 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
            className="mx-auto mb-5 h-12 w-12 rounded-full border-2 border-white/10 border-t-blue-400"
          />
          <p className="section-kicker mb-2">Centro operativo</p>
          <p className="text-base font-semibold text-white">{t('common.loading')}</p>
          <p className="mt-1 text-sm text-neutral-500">{t('common.syncing')}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: t('dashboard.revenue'),
      value: formatCurrency(stats.revenue),
      change: formatChangeValue(stats.revenueChange),
      signal: stats.revenueChange.startsWith('+') || stats.revenueChange === 'NEW' ? 'Expansión' : 'Estable',
      icon: TrendingUp,
      accent: 'text-blue-300',
      ring: 'border-blue-400/14 from-blue-500/14 to-transparent',
    },
    {
      label: t('dashboard.customers'),
      value: stats.customers.toString(),
      change: stats.customers > 0 ? 'Activo' : 'En espera',
      signal: 'Grafo relacional',
      icon: Contact,
      accent: 'text-violet-300',
      ring: 'border-violet-400/14 from-violet-500/14 to-transparent',
    },
    {
      label: t('dashboard.inventory'),
      value: stats.products.toString(),
      change: stats.products > 0 ? 'Indexado' : 'Pendiente',
      signal: 'Tejido de activos',
      icon: Shapes,
      accent: 'text-emerald-300',
      ring: 'border-emerald-400/14 from-emerald-500/14 to-transparent',
    },
    {
      label: t('dashboard.orders'),
      value: stats.orders.toString(),
      change: stats.orders > 0 ? 'Activo' : 'Inactivo',
      signal: 'Flujo transaccional',
      icon: Layers,
      accent: 'text-amber-300',
      ring: 'border-amber-400/14 from-amber-500/14 to-transparent',
    },
  ];

  const systemModules = [
    {
      label: t('dashboard.ops_status.inventory'),
      status: stats.products > 0 ? 'Indexado' : 'Pendiente',
      icon: Shapes,
      good: stats.products > 0,
    },
    {
      label: t('dashboard.ops_status.orders'),
      status: stats.orders > 0 ? 'En flujo' : 'Inactivo',
      icon: Receipt,
      good: stats.orders > 0,
    },
    {
      label: t('dashboard.ops_status.customers'),
      status: stats.customers > 0 ? 'Sincronizado' : 'Pendiente',
      icon: Contact,
      good: stats.customers > 0,
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="hero-gradient overflow-hidden rounded-[32px] border border-white/10 p-6 md:p-8 xl:p-10"
      >
        <div className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="relative">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="operator-badge">
                <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
                Estado operativo en vivo
              </span>
              <span className="telemetry-chip">
                <Fingerprint className="h-3.5 w-3.5 text-blue-300" />
                Núcleo operativo IA
              </span>
            </div>

            <h1 className="section-title glow-text max-w-3xl text-3xl leading-none md:text-4xl xl:text-5xl">
              {company?.name || 'Remix OS'} opera ahora como un centro operativo vivo.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-300 md:text-lg">
              {operatingBrief}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-12 gap-2 px-6"
                onClick={() => navigate('/orders', { state: { action: 'create' } })}
              >
                <Plus className="h-4 w-4" />
                {t('dashboard.new_order')}
              </Button>
              <Button
                variant="secondary"
                className="h-12 gap-2 px-6"
                onClick={() => window.dispatchEvent(new CustomEvent('open-copilot'))}
              >
                <Cpu className="h-4 w-4" />
                Abrir operador IA
              </Button>
              <Button
                variant="ghost"
                className="h-12 gap-2 px-4"
                onClick={handleExportPDF}
                disabled={exporting}
              >
                <Download className={cn('h-4 w-4', exporting && 'animate-bounce')} />
                {exporting ? t('dashboard.generating') : t('dashboard.download_report')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="data-tile">
              <p className="section-kicker mb-2 !text-neutral-400">Integridad del sistema</p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-white">{allSystemsReady ? '98%' : '71%'}</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    {allSystemsReady ? 'Los módulos principales responden con normalidad.' : 'La activación sigue en curso en los módulos comerciales.'}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/14 bg-blue-500/10">
                  <Sparkles className="h-5 w-5 text-blue-300" />
                </div>
              </div>
            </div>

            <div className="data-tile">
              <p className="section-kicker mb-2 !text-neutral-400">Pulso comercial</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-neutral-300">
                  <span>Delta de ingresos</span>
                  <span className="font-mono text-blue-300">{formatChangeValue(stats.revenueChange)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-neutral-300">
                  <span>Transacciones</span>
                  <span className="font-mono text-white">{stats.orders}</span>
                </div>
              </div>
            </div>

            <div className="data-tile">
              <div className="mb-2 flex items-center justify-between">
                <p className="section-kicker !text-neutral-400">Meta diaria</p>
                <button
                  onClick={() => { setGoalInput(dailyGoal > 0 ? String(dailyGoal) : ''); setIsGoalEditing(true); }}
                  className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-white"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
              </div>
              {isGoalEditing ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setIsGoalEditing(false); }}
                    className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-400/40 focus:outline-none"
                    placeholder="Ej. 1000"
                  />
                  <button onClick={saveGoal} className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : dailyGoal > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">{formatCurrency(todayRevenue)}</p>
                      <p className="text-xs text-neutral-500">de {formatCurrency(dailyGoal)} hoy</p>
                    </div>
                    {goalMet && <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">¡Meta!</span>}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${goalProgress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', goalMet ? 'bg-emerald-400' : goalProgress > 60 ? 'bg-blue-400' : goalProgress > 30 ? 'bg-amber-400' : 'bg-red-400')}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">{goalProgress.toFixed(0)}% completado</p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-8 w-8 shrink-0 text-neutral-700" />
                  <div>
                    <p className="text-sm font-medium text-neutral-400">Sin meta configurada</p>
                    <p className="mt-0.5 text-xs text-neutral-600">Toca "Editar" para fijar tu objetivo diario de ventas.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {showChecklist && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="overflow-hidden border-blue-400/14 bg-[linear-gradient(180deg,rgba(32,67,138,0.18),rgba(12,16,24,0.96))]">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="section-kicker mb-3">Secuencia de activación</p>
                <h2 className="section-title text-2xl md:text-3xl">{t('dashboard.setup.title')}</h2>
                <p className="mt-3 section-subtitle">{t('dashboard.setup.description')}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: t('dashboard.setup.register_product'),
                    desc: t('dashboard.setup.register_product_desc'),
                    done: stats.products > 0,
                    link: '/products',
                    icon: <Database className="h-5 w-5" />,
                  },
                  {
                    label: t('dashboard.setup.add_customer'),
                    desc: t('dashboard.setup.add_customer_desc'),
                    done: stats.customers > 0,
                    link: '/customers',
                    icon: <UserPlus className="h-5 w-5" />,
                  },
                  {
                    label: t('dashboard.setup.log_sale'),
                    desc: t('dashboard.setup.log_sale_desc'),
                    done: stats.orders > 0,
                    link: '/orders',
                    icon: <Receipt className="h-5 w-5" />,
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.link, { state: { action: 'create' } })}
                    className={cn(
                      'data-tile text-left transition-all hover:-translate-y-0.5',
                      item.done ? 'border-emerald-400/16' : 'hover:border-blue-400/16'
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-2xl border',
                        item.done
                          ? 'border-emerald-400/18 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/10 bg-white/[0.03] text-neutral-300'
                      )}>
                        {item.done ? <CheckCircle2 className="h-5 w-5" /> : item.icon}
                      </div>
                      <ChevronRight className="h-4 w-4 text-neutral-600" />
                    </div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.05 }}
              >
                <Card className={cn('relative overflow-hidden bg-[rgba(9,12,18,0.94)]', stat.ring)}>
                  <div className={cn('absolute inset-x-0 top-0 h-20 bg-gradient-to-b opacity-80', stat.ring)} />
                  <div className="relative">
                    <div className="mb-3 flex items-start justify-between gap-2 md:mb-5 md:gap-3">
                      <div className="min-w-0">
                        <p className="section-kicker mb-1 !text-neutral-500 md:mb-2">{stat.signal}</p>
                        <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 md:text-[11px] md:tracking-[0.18em]">{stat.label}</p>
                      </div>
                      <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] sm:flex">
                        <stat.icon className={cn('h-5 w-5', stat.accent)} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tracking-tight text-white md:text-3xl">{stat.value}</p>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="font-mono uppercase tracking-[0.18em] text-neutral-500">Señal</span>
                      <span className="font-mono text-blue-200">{stat.change}</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="overflow-hidden">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker mb-2">Telemetría financiera</p>
                  <h3 className="section-title text-2xl">{t('dashboard.financial_intelligence')}</h3>
                  <p className="section-subtitle mt-2">{t('dashboard.revenue_optimization')}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/14 bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-300" />
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                <span className="telemetry-chip">
                  <span className="status-dot bg-blue-400 text-blue-400" />
                  Flujo de ingresos
                </span>
                <span className="telemetry-chip">Señal 7 días</span>
              </div>

              <div className="h-[290px] rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
                {chartData.some((d) => d.sales > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5b8cff" stopOpacity={0.42} />
                          <stop offset="95%" stopColor="#5b8cff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 8" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#7b8594', fontWeight: 700 }}
                        dy={12}
                      />
                      <Tooltip
                        cursor={{ stroke: 'rgba(91,140,255,0.25)', strokeWidth: 1 }}
                        contentStyle={{
                          backgroundColor: '#0a0e14',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '18px',
                          color: '#ffffff',
                          fontSize: '12px',
                        }}
                        labelStyle={{ color: '#cbd5e1', fontWeight: 700 }}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#5b8cff" strokeWidth={2.8} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-[20px] border border-dashed border-white/8 bg-white/[0.02] text-center">
                    <Activity className="mb-4 h-8 w-8 text-neutral-700" />
                    <p className="text-sm font-semibold text-neutral-400">Aún no hay señal de ingresos</p>
                    <p className="mt-1 text-xs text-neutral-600">La telemetría financiera aparecerá cuando empiecen a fluir pedidos completados.</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker mb-2">Flujo operativo</p>
                  <h3 className="section-title text-2xl">{t('dashboard.system_log')}</h3>
                  <p className="section-subtitle mt-2">Eventos en vivo priorizados por relevancia operativa.</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/14 bg-amber-500/10">
                  <History className="h-5 w-5 text-amber-300" />
                </div>
              </div>

              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                {activityMeta.length === 0 ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/8 bg-white/[0.02] text-center">
                    <History className="mb-4 h-8 w-8 text-neutral-700" />
                    <p className="text-sm font-semibold text-neutral-400">El flujo operativo está en espera</p>
                    <p className="mt-1 max-w-xs text-xs text-neutral-600">Aquí aparecerán pedidos, clientes, inventario y acciones del sistema a medida que el negocio entre en movimiento.</p>
                  </div>
                ) : (
                  activityMeta.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="surface-elevated overflow-hidden p-4"
                    >
                      <div className={cn('mb-3 h-1 rounded-full bg-gradient-to-r', item.accent)} />
                      <div className="flex gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <span className="telemetry-chip !px-2.5 !py-1 !text-[9px]">{item.chip}</span>
                            <span className="timeline-stamp">
                              {getRelativeTime(item.createdAt)}
                            </span>
                          </div>
                          <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-neutral-400">{item.subtitle}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden border-blue-400/14 bg-[linear-gradient(180deg,rgba(28,43,90,0.52),rgba(8,11,16,0.96))]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/16 bg-blue-500/12">
                <Cpu className="h-5 w-5 text-blue-200" />
              </div>
              <div>
                <p className="section-kicker">Informe operativo</p>
                <h3 className="section-title text-xl">{t('dashboard.business_briefing')}</h3>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="surface-elevated p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{t('dashboard.system_status')}</span>
                  <span className="operator-badge !px-2.5 !py-1">Seguro</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: allSystemsReady ? '98%' : '71%' }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full bg-[linear-gradient(90deg,#4d7cff,#7cb8ff)]"
                  />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-neutral-300">{operatingBrief}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="data-tile">
                  <p className="section-kicker mb-2 !text-neutral-500">Perfil de riesgo</p>
                  <p className="text-lg font-semibold text-white">{allSystemsReady ? 'Estable' : 'Activación en vigilancia'}</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    {allSystemsReady ? 'No se detectan incidencias críticas en la señal actual.' : 'Completa la secuencia de activación para estabilizar el grafo operativo.'}
                  </p>
                </div>
                <div className="data-tile">
                  <p className="section-kicker mb-2 !text-neutral-500">Sincronización de datos</p>
                  <p className="text-lg font-semibold text-white">En vivo</p>
                  <p className="mt-1 text-sm text-neutral-400">La telemetría comercial está entrando al panel en tiempo real.</p>
                </div>
              </div>

              <Button
                onClick={() => window.dispatchEvent(new CustomEvent('open-copilot'))}
                className="h-12 w-full gap-2 text-[11px] font-black uppercase tracking-[0.22em]"
              >
                {t('dashboard.view_assistant')}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="section-kicker mb-2 !text-neutral-500">Módulos del sistema</p>
                <h3 className="section-title text-xl">{t('dashboard.ops_status.title')}</h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <Fingerprint className="h-4.5 w-4.5 text-neutral-300" />
              </div>
            </div>

            <div className="space-y-3">
              {systemModules.map((item) => (
                <div key={item.label} className="surface-elevated flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-2xl border',
                      item.good ? 'border-emerald-400/14 bg-emerald-500/8 text-emerald-300' : 'border-amber-400/14 bg-amber-500/8 text-amber-300'
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Salud del módulo</p>
                    </div>
                  </div>
                  <span className={cn(
                    'rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]',
                    item.good ? 'border-emerald-400/14 bg-emerald-500/8 text-emerald-300' : 'border-amber-400/14 bg-amber-500/8 text-amber-300'
                  )}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {invoiceMetrics.invoicesCount > 0 && (
            <Card className={cn(
              'overflow-hidden',
              invoiceMetrics.overdueCount > 0
                ? 'border-amber-400/16 bg-[linear-gradient(180deg,rgba(92,60,10,0.22),rgba(8,11,16,0.96))]'
                : 'border-blue-400/14 bg-[linear-gradient(180deg,rgba(28,43,90,0.32),rgba(8,11,16,0.96))]'
            )}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker mb-2 !text-neutral-500">Facturación</p>
                  <h3 className="section-title text-xl">Cobro pendiente</h3>
                </div>
                <div className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
                  invoiceMetrics.overdueCount > 0
                    ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                    : 'border-blue-400/20 bg-blue-500/10 text-blue-200'
                )}>
                  <FileText className="h-5 w-5" />
                </div>
              </div>

              <p className="font-mono text-3xl font-bold text-white">{formatCurrency(invoiceMetrics.unpaidTotal)}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {invoiceMetrics.invoicesCount} documento{invoiceMetrics.invoicesCount === 1 ? '' : 's'} ·{' '}
                {invoiceMetrics.overdueCount > 0
                  ? `${invoiceMetrics.overdueCount} vencida${invoiceMetrics.overdueCount === 1 ? '' : 's'}`
                  : 'Sin vencimientos'}
              </p>

              <button
                onClick={() => navigate('/invoices')}
                className={cn(
                  'mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-2.5 text-[11px] font-black uppercase tracking-[0.2em] transition-all',
                  invoiceMetrics.overdueCount > 0
                    ? 'border-amber-400/16 text-amber-200/80 hover:border-amber-400/25 hover:bg-amber-500/8'
                    : 'border-blue-400/16 text-blue-200/80 hover:border-blue-400/25 hover:bg-blue-500/8'
                )}
              >
                Abrir facturación
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </Card>
          )}

          {stockAlerts.length > 0 && (
            <Card className="border-amber-400/14 bg-[linear-gradient(180deg,rgba(92,60,10,0.28),rgba(8,11,16,0.96))]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker mb-2 !text-amber-400/70">Presión de inventario</p>
                  <h3 className="section-title text-xl">Predicción de rotura de stock</h3>
                  <p className="section-subtitle mt-1">Basado en velocidad de ventas de los últimos 14 días.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                </div>
              </div>
              <div className="space-y-2">
                {stockAlerts.map(alert => {
                  const isUrgent = alert.daysLeft !== null && alert.daysLeft <= 3;
                  const isCritical = alert.stockLevel === 0;
                  return (
                    <button
                      key={alert.id}
                      onClick={() => navigate('/inventory')}
                      className={cn(
                        'surface-elevated block w-full p-3 text-left transition-all',
                        isCritical ? 'border-red-400/20 bg-red-500/5 hover:border-red-400/30' :
                        isUrgent ? 'border-amber-400/20 bg-amber-500/5 hover:border-amber-400/30' :
                        'hover:border-white/10'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">{alert.name}</p>
                        <span className={cn(
                          'shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                          isCritical ? 'border-red-400/20 bg-red-500/10 text-red-300' :
                          isUrgent ? 'border-amber-400/20 bg-amber-500/10 text-amber-300' :
                          'border-white/10 bg-white/5 text-neutral-400'
                        )}>
                          {isCritical ? 'Sin stock' :
                           alert.daysLeft !== null ? `~${alert.daysLeft}d` : `${alert.stockLevel} u.`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {isCritical ? 'Agotado — reabastecer ahora' :
                         alert.daysLeft !== null ? `${alert.stockLevel} u. restantes · ${alert.velocity.toFixed(1)} u/día` :
                         `${alert.stockLevel} unidades · sin ventas recientes`}
                      </p>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => navigate('/inventory')}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/14 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300/80 transition-all hover:border-amber-400/25 hover:bg-amber-500/8"
              >
                Ver inventario completo
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </Card>
          )}

          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="section-kicker mb-2 !text-neutral-500">Playbooks IA</p>
                <h3 className="section-title text-xl">Siguientes movimientos sugeridos</h3>
              </div>
              <AlertTriangle className="h-4.5 w-4.5 text-neutral-500" />
            </div>

            <div className="space-y-3">
              {[
                ...(invoiceMetrics.overdueCount > 0
                  ? [{
                      label: `Cobrar ${invoiceMetrics.overdueCount} factura${invoiceMetrics.overdueCount === 1 ? '' : 's'} vencida${invoiceMetrics.overdueCount === 1 ? '' : 's'}`,
                      detail: `Tienes ${formatCurrency(invoiceMetrics.unpaidTotal)} pendiente. Revisa las facturas vencidas y dispara recordatorios al cliente.`,
                      action: () => navigate('/invoices'),
                      tone: 'amber' as const,
                    }]
                  : invoiceMetrics.unpaidTotal > 0
                    ? [{
                        label: 'Revisar cobros pendientes',
                        detail: `${formatCurrency(invoiceMetrics.unpaidTotal)} aún sin cobrar. Marca como pagadas las que ya hayas conciliado.`,
                        action: () => navigate('/invoices'),
                        tone: 'blue' as const,
                      }]
                    : []),
                {
                  label: 'Revisar presión por bajo stock',
                  detail: 'Abre la inteligencia de inventario e inspecciona cobertura antes de que la demanda aumente.',
                  action: () => navigate('/inventory'),
                  tone: 'blue' as const,
                },
                {
                  label: 'Inspeccionar flujo transaccional',
                  detail: 'Revisa pedidos recientes y detecta fricciones de conversión antes de que escalen.',
                  action: () => navigate('/orders'),
                  tone: 'blue' as const,
                },
                {
                  label: 'Pedir un informe ejecutivo al operador IA',
                  detail: 'Genera un resumen de ingresos, movimiento de clientes y riesgos operativos.',
                  action: () => window.dispatchEvent(new CustomEvent('open-copilot')),
                  tone: 'blue' as const,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={cn(
                    'surface-elevated block w-full p-4 text-left transition-all',
                    item.tone === 'amber'
                      ? 'border-amber-400/20 bg-amber-500/[0.06] hover:border-amber-400/30 hover:bg-amber-500/[0.10]'
                      : 'hover:border-blue-400/16 hover:bg-white/[0.035]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border',
                      item.tone === 'amber'
                        ? 'border-amber-400/20 bg-amber-500/12'
                        : 'border-blue-400/12 bg-blue-500/8'
                    )}>
                      <ChevronRight className={cn(
                        'h-4 w-4',
                        item.tone === 'amber' ? 'text-amber-300' : 'text-blue-300'
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-neutral-400">{item.detail}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

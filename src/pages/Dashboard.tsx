import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/Common';
import { 
  Users, 
  Package, 
  ClipboardList, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreHorizontal,
  Plus,
  ArrowDownLeft,
  ShoppingBag,
  UserPlus,
  Box,
  History,
  Download,
  CheckCircle2,
  ChevronRight,
  BrainCircuit,
  Sparkles,
  Zap,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, limit, orderBy, Timestamp, onSnapshot, getDocs } from 'firebase/firestore';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion } from 'motion/react';
import { format, subDays, startOfDay, eachDayOfInterval, isSameDay } from 'date-fns';
import { exportDashboardToPDF } from '../lib/exportUtils';
import { cn } from '../components/Common';

interface ActivityItem {
  id: string;
  type: 'order' | 'customer' | 'product' | 'movement';
  title: string;
  subtitle: string;
  createdAt: Timestamp;
}

export function Dashboard() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    customers: 0,
    products: 0,
    orders: 0,
    revenue: 0,
    prevRevenue: 0 // For mock change calculation
  });

  const [chartData, setChartData] = useState<{ name: string; sales: number }[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!company) return;

    setLoading(true);
    
    // 1. Orders Listener (Real-time stats and chart)
    const ordersQ = query(
      collection(db, 'orders'), 
      where('companyId', '==', company.id),
      where('status', '==', 'completed')
    );

    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      let totalRev = 0;
      snapshot.forEach(doc => { totalRev += doc.data().total || 0; });
      
      setStats(prev => ({
        ...prev,
        orders: snapshot.size,
        revenue: totalRev,
        prevRevenue: totalRev * 0.9
      }));

      // Process Chart Data
      const now = new Date();
      const sevenDaysAgo = subDays(startOfDay(now), 6);
      const days = eachDayOfInterval({ start: sevenDaysAgo, end: now });
      const dayWiseSales = days.map(day => {
        const salesForDay = snapshot.docs
          .filter(doc => {
            const date = doc.data().createdAt?.toDate();
            return date && isSameDay(date, day);
          })
          .reduce((sum, doc) => sum + (doc.data().total || 0), 0);

        return {
          name: format(day, 'EEE'),
          sales: salesForDay
        };
      });
      setChartData(dayWiseSales);
    });

    // 2. Customers Listener
    const customersQ = query(collection(db, 'customers'), where('companyId', '==', company.id));
    const unsubscribeCustomers = onSnapshot(customersQ, (snapshot) => {
      setStats(prev => ({ ...prev, customers: snapshot.size }));
    });

    // 3. Products Listener
    const productsQ = query(collection(db, 'products'), where('companyId', '==', company.id));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      setStats(prev => ({ ...prev, products: snapshot.size }));
      setLoading(false); // First one to return usually resets loading
    });

    // 4. Activity Listener
    const activityQ = query(
      collection(db, 'activities'), 
      where('companyId', '==', company.id), 
      orderBy('createdAt', 'desc'), 
      limit(8)
    );
    const unsubscribeActivity = onSnapshot(activityQ, (snapshot) => {
      const activityList = snapshot.docs.map(d => ({
        id: d.id,
        type: d.data().type?.split('_')[0] || 'order',
        title: d.data().title,
        subtitle: d.data().subtitle,
        createdAt: d.data().createdAt
      }));
      setActivities(activityList as ActivityItem[]);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
      unsubscribeProducts();
      unsubscribeActivity();
    };
  }, [company]);

  const [exporting, setExporting] = useState(false);
  const showChecklist = stats.products === 0 || stats.customers === 0 || stats.orders === 0;

  const handleExportPDF = async () => {
    if (!company) return;
    setExporting(true);
    try {
      // Fetch data for the report
      const [recentOrdersSnap, productsSnap] = await Promise.all([
        getDocs(query(collection(db, 'orders'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(10))),
        getDocs(query(collection(db, 'products'), where('companyId', '==', company.id), orderBy('stockLevel', 'asc'), limit(10)))
      ]);

      const modules = [
        {
          title: 'Core Metrics',
          data: [
            { Metric: 'Total Revenue', Value: `$${stats.revenue.toLocaleString()}` },
            { Metric: 'Active Customers', Value: stats.customers.toString() },
            { Metric: 'Asset Types', Value: stats.products.toString() },
            { Metric: 'Total Transactions', Value: stats.orders.toString() }
          ],
          columns: ['Metric', 'Value']
        },
        {
          title: 'Recent Transactions',
          data: recentOrdersSnap.docs.map(d => ({
            ID: d.id.slice(-6).toUpperCase(),
            Customer: d.data().customerName,
            Total: `$${d.data().total}`,
            Status: d.data().status,
            Date: d.data().createdAt
          })),
          columns: ['ID', 'Customer', 'Total', 'Status', 'Date']
        },
        {
          title: 'Inventory Alert (Lowest Stock)',
          data: productsSnap.docs.map(d => ({
            Name: d.data().name,
            SKU: d.data().sku,
            Stock: d.data().stockLevel,
            Status: d.data().status
          })),
          columns: ['Name', 'SKU', 'Stock', 'Status']
        }
      ];

      exportDashboardToPDF(company.name, modules);
    } catch (err) {
      console.error("PDF Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag className="w-4 h-4 text-blue-600" />;
      case 'customer': return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'product': return <Box className="w-4 h-4 text-amber-600" />;
      case 'movement': return <History className="w-4 h-4 text-purple-600" />;
      case 'ai':
      case 'ai_sync': return <BrainCircuit className="w-4 h-4 text-blue-400" />;
      default: return <Plus className="w-4 h-4" />;
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

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="space-y-6 text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-2 border-white/10 border-t-blue-500 rounded-full mx-auto" 
          />
          <div className="space-y-2">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white">Loading OS</p>
            <p className="text-xs text-neutral-500 font-mono italic">Synchronizing business metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2">Operational Overview</h1>
          <p className="text-neutral-500 text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Remix OS is active for {company?.name}. System status: Optimized.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            className="px-6 gap-2"
            onClick={handleExportPDF}
            disabled={exporting}
          >
            {exporting ? <History className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Generating...' : 'Download Report'}
          </Button>
          <Button className="px-6 flex gap-2" onClick={() => navigate('/orders', { state: { action: 'create' } })}>
            <Plus className="w-4 h-4" /> New Order
          </Button>
        </div>
      </div>

      {showChecklist && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-12 overflow-hidden"
        >
          <Card className="bg-blue-500/[0.02] border-blue-500/20 p-8 rounded-3xl">
            <div className="flex flex-col lg:flex-row gap-10 items-center">
              <div className="lg:w-1/3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Setup Checklist</span>
                </div>
                <h2 className="text-2xl font-bold mb-4">Complete your setup.</h2>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Complete these essential steps to optimize your business environment and unlock advanced AI insights.
                </p>
              </div>
              
              <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
                {[
                  { 
                    label: 'Register Product', 
                    desc: 'Add your first product to inventory.', 
                    done: stats.products > 0,
                    link: '/products',
                    icon: <Box className="w-5 h-5" />
                  },
                  { 
                    label: 'Add Customer', 
                    desc: 'Initialize a contact in your CRM.', 
                    done: stats.customers > 0,
                    link: '/customers',
                    icon: <UserPlus className="w-5 h-5" />
                  },
                  { 
                    label: 'Log Sale', 
                    desc: 'Create your first completed order.', 
                    done: stats.orders > 0,
                    link: '/orders',
                    icon: <ShoppingBag className="w-5 h-5" />
                  },
                ].map((item, i) => (
                  <div 
                    key={item.label}
                    onClick={() => navigate(item.link, { state: { action: 'create' } })}
                    className={cn(
                      "group relative p-5 rounded-2xl border transition-all cursor-pointer",
                      item.done 
                        ? "bg-emerald-500/5 border-emerald-500/20" 
                        : "bg-white/[0.03] border-white/[0.05] hover:border-blue-500/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border transition-colors",
                        item.done ? "border-emerald-500/20 text-emerald-500" : "border-white/10 text-neutral-500 group-hover:text-blue-500"
                      )}>
                        {item.done ? <CheckCircle2 className="w-5 h-5" /> : item.icon}
                      </div>
                      <ChevronRight className={cn("w-4 h-4", item.done ? "text-emerald-500/50" : "text-neutral-700")} />
                    </div>
                    <h3 className={cn("font-bold text-sm mb-1", item.done ? "text-emerald-500" : "text-neutral-200")}>{item.label}</h3>
                    <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">{item.desc}</p>
                    {item.done && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Main Stat Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Cumulative Revenue', value: `$${stats.revenue.toLocaleString()}`, change: '+12.4%', icon: TrendingUp, color: 'text-blue-500' },
              { label: 'Active Pipeline', value: stats.customers.toString(), change: '+5.1%', icon: Users, color: 'text-purple-500' },
              { label: 'Unit Stock', value: stats.products.toString(), change: 'STABLE', icon: Package, color: 'text-emerald-500' },
              { label: 'Order Velocity', value: stats.orders.toString(), change: '+8.2%', icon: ClipboardList, color: 'text-orange-500' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="group hover:bg-white/[0.03] p-6 h-full relative overflow-hidden transition-all duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("w-10 h-10 bg-white/[0.03] rounded-xl flex items-center justify-center border border-white/[0.05]", stat.color)}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-neutral-500">
                      {stat.change}
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                  <h3 className="text-2xl font-bold tracking-tight text-white">{stat.value}</h3>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="relative overflow-hidden group p-6">
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl tracking-tight">Financial Intelligence</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Revenue Cycle Optimization</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="h-[280px] -mx-2">
                {chartData.some(d => d.sales > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#666', fontWeight: 600 }} 
                        dy={10}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0A0A0A', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '16px',
                          fontSize: '12px'
                        }}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-600 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                    <Activity className="w-8 h-8 mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest italic">Data_Buffer_Void</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="flex flex-col p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl tracking-tight">System Log</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Live Activity Stream</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <History className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] scrollbar-hide pr-2">
                {activities.map((item, i) => (
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
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* AI Assistant Sidebar */}
        <div className="space-y-8">
          <Card className="p-8 bg-blue-600/5 border-blue-500/20 relative overflow-hidden group shadow-[0_20px_50px_rgba(59,130,246,0.05)]">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
              <BrainCircuit className="w-24 h-24" />
            </div>
            
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Business Briefing</h3>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="space-y-3">
                 <div className="flex justify-between items-end">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">System Status</p>
                    <p className="text-[10px] font-mono font-bold text-emerald-500 tracking-tighter">SECURE</p>
                 </div>
                 <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: "0%" }} animate={{ width: "98%" }} className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                 </div>
              </div>

              <p className="text-sm text-neutral-400 leading-relaxed font-medium">
                The system is operating at <b>Normal Capacity</b>. Current insights indicate <b>stable performance</b> with ${stats.revenue.toLocaleString()} in revenue.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                 <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[9px] font-black text-neutral-600 uppercase mb-1">Risk Profile</p>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">Status_Nominal</p>
                 </div>
                 <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[9px] font-black text-neutral-600 uppercase mb-1">Data Sync</p>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">Active</p>
                 </div>
              </div>

              <Button 
                onClick={() => {
                  const botIcon = document.querySelector('.lucide-bot');
                  if (botIcon) (botIcon.closest('button') as HTMLButtonElement).click();
                }}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] relative group/brief overflow-hidden"
              >
                 <span className="relative z-10 flex items-center justify-center gap-2">View Assistant <ArrowUpRight className="w-4 h-4" /></span>
                 <motion.div 
                   animate={{ x: ['100%', '-100%'] }}
                   transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                   className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" 
                 />
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-neutral-900 border-white/5">
             <h3 className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-6">Operational Status</h3>
             <div className="space-y-4">
                {[
                  { label: 'Inventory Level', status: stats.products > 0 ? 'OPTIMAL' : 'PENDING', icon: Package, color: 'text-neutral-500' },
                  { label: 'Order Activity', status: stats.orders > 0 ? 'NOMINAL' : 'IDLE', icon: ShoppingBag, color: 'text-neutral-500' },
                  { label: 'Customer Sync', status: stats.customers > 0 ? 'SYNCED' : 'PENDING', icon: Users, color: 'text-neutral-500' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] group hover:bg-white/[0.02] transition-all">
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


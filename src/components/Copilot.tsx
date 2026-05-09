import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BrainCircuit, X, Send, Zap, TrendingUp, Package, Users,
  Activity, AlertCircle, Sparkles, ChevronRight, MessageSquare,
  RefreshCcw, FileText, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { chatCopilot, getProactiveThoughts } from '../services/gemini';
import { cn } from './Common';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useLocale } from '../hooks/useLocale';
import { format } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  streaming?: boolean;
  timestamp: Date;
  command?: {
    type: string;
    params: string;
    summary: string;
    isReviewOnly: boolean;
  };
  commandStatus?: 'pending' | 'executed' | 'dismissed';
}

interface Insight {
  id: string;
  text: string;
  priority?: string;
  timestamp: Date;
}

interface LiveMetrics {
  revenue: number;
  ordersThisWeek: number;
  lowStockCount: number;
  customers: number;
}

export function Copilot() {
  const { company, user } = useAuth();
  const { t, language, formatCurrency } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const isPOSRoute = location.pathname === '/pos';

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'intel'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadInsights, setUnreadInsights] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [operatorHistory, setOperatorHistory] = useState<{ type: string; action: string; timestamp: Date }[]>([]);
  const [actionProcessing, setActionProcessing] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => {
          if (!prev) setUnreadInsights(0);
          return !prev;
        });
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // open-copilot custom event (from Dashboard)
  useEffect(() => {
    const handler = () => {
      setIsOpen(true);
      setUnreadInsights(0);
      setActiveTab('chat');
    };
    window.addEventListener('open-copilot', handler);
    return () => window.removeEventListener('open-copilot', handler);
  }, []);

  // Auto-focus input
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen, activeTab]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Show toast
  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Load persisted chat
  useEffect(() => {
    if (!company) return;
    try {
      const stored = localStorage.getItem(`copilot_messages_${company.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setMessages(parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
          streaming: false,
        })));
      }
    } catch (_) {}
  }, [company?.id]);

  // Save chat on change (debounced, skip streaming)
  useEffect(() => {
    if (!company || messages.length === 0) return;
    const timer = setTimeout(() => {
      const toSave = messages
        .filter(m => !m.streaming)
        .slice(-60)
        .map(m => ({ ...m, timestamp: m.timestamp.toISOString() }));
      localStorage.setItem(`copilot_messages_${company.id}`, JSON.stringify(toSave));
    }, 600);
    return () => clearTimeout(timer);
  }, [messages, company?.id]);

  // Simulated streaming (word-by-word reveal)
  const simulateStreaming = useCallback((msgId: string, fullText: string, onDone?: () => void) => {
    const words = fullText.split(' ');
    let i = 0;
    if (streamingRef.current) clearInterval(streamingRef.current);
    streamingRef.current = setInterval(() => {
      i++;
      const partial = words.slice(0, i).join(' ');
      const done = i >= words.length;
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId ? { ...m, text: partial, streaming: !done } : m
        )
      );
      if (done) {
        if (streamingRef.current) clearInterval(streamingRef.current);
        onDone?.();
      }
    }, 22);
  }, []);

  // Background monitoring
  useEffect(() => {
    if (!company) return;

    const runMonitoring = async () => {
      try {
        let productsSnap: any = { docs: [], size: 0 };
        let ordersSnap: any = { docs: [], size: 0 };
        let customersSnap: any = { docs: [], size: 0 };
        let remindersSnap: any = { docs: [], size: 0 };

        try { productsSnap = await getDocs(query(collection(db, 'products'), where('companyId', '==', company.id))); } catch (e) { console.warn('Monitoring: Products', e); }
        try { ordersSnap = await getDocs(query(collection(db, 'orders'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(30))); } catch (e) { console.warn('Monitoring: Orders', e); }
        try { customersSnap = await getDocs(query(collection(db, 'customers'), where('companyId', '==', company.id))); } catch (e) { console.warn('Monitoring: Customers', e); }
        try { remindersSnap = await getDocs(query(collection(db, 'reminders'), where('companyId', '==', company.id), where('status', '==', 'pending'))); } catch (e) { console.warn('Monitoring: Reminders', e); }

        const now = new Date();
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const recentOrders = ordersSnap.docs.filter((d: any) => d.data().createdAt?.toDate() > last7Days);
        const prevOrders = ordersSnap.docs.filter((d: any) => d.data().createdAt?.toDate() <= last7Days && d.data().createdAt?.toDate() > prev7Days);
        const totalRevenue = ordersSnap.docs.reduce((acc: number, doc: any) => acc + (doc.data().totalAmount || 0), 0);

        const lowStockProducts = productsSnap.docs
          .map((d: any) => ({ id: d.id, name: d.data().name, stock: d.data().stockLevel }))
          .filter((p: any) => p.stock <= 10);

        setMetrics({
          revenue: totalRevenue,
          ordersThisWeek: recentOrders.length,
          lowStockCount: lowStockProducts.length,
          customers: customersSnap.size,
        });

        // Build product + customer aggregates for proactive AI
        const productOrders: Record<string, { name: string; quantity: number; revenue: number }> = {};
        ordersSnap.docs.forEach((doc: any) => {
          const data = doc.data();
          (data.items || []).forEach((item: any) => {
            if (!productOrders[item.productId]) {
              productOrders[item.productId] = { name: item.productName || 'Unknown', quantity: 0, revenue: 0 };
            }
            productOrders[item.productId].quantity += item.quantity || 0;
            productOrders[item.productId].revenue += (item.price || 0) * (item.quantity || 0);
          });
        });
        const topProducts = Object.values(productOrders).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

        const customerOrders: Record<string, { name: string; count: number; total: number }> = {};
        ordersSnap.docs.forEach((doc: any) => {
          const data = doc.data();
          if (!customerOrders[data.customerId]) {
            customerOrders[data.customerId] = { name: data.customerName || 'Unknown', count: 0, total: 0 };
          }
          customerOrders[data.customerId].count++;
          customerOrders[data.customerId].total += data.totalAmount || 0;
        });
        const topCustomers = Object.values(customerOrders).sort((a, b) => b.total - a.total).slice(0, 3);

        const thoughtContext = {
          companyId: company.id,
          companyName: company.name,
          customersCount: customersSnap.size,
          productsCount: productsSnap.size,
          recentRevenue: totalRevenue.toFixed(2),
          salesVelocity: {
            currentPeriodOrders: recentOrders.length,
            previousPeriodOrders: prevOrders.length,
            trend: recentOrders.length >= prevOrders.length ? 'up' : 'down',
          },
          lowStockCount: lowStockProducts.length,
          inventoryStatus: lowStockProducts.slice(0, 3),
          topProducts,
          topCustomers,
        };

        try {
          const thoughts = await getProactiveThoughts(thoughtContext, language);
          if (thoughts && thoughts.length > 0) {
            const insight = thoughts[0];
            const newInsight: Insight = {
              id: `insight-${Date.now()}`,
              text: insight.text,
              priority: insight.priority,
              timestamp: new Date(),
            };
            setInsights(prev => {
              const alreadyExists = prev.some(i => i.text === newInsight.text);
              if (alreadyExists) return prev;
              return [newInsight, ...prev].slice(0, 20);
            });
            setUnreadInsights(prev => prev + 1);
            if (!isOpen) showToast(insight.text);
          }
        } catch (e) {
          console.warn('Proactive thoughts failed:', e);
        }
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    };

    runMonitoring();
    const interval = setInterval(runMonitoring, 60000 * 2);
    return () => clearInterval(interval);
  }, [company?.id, isOpen, showToast, language]);

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || inputText).trim();
    if (!textToSend || !company) return;
    if (!overrideText) setInputText('');

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      let productsSnap: any = { docs: [], size: 0 };
      let ordersSnap: any = { docs: [], size: 0 };
      let customersSnap: any = { docs: [], size: 0 };
      let remindersSnap: any = { docs: [], size: 0 };
      let messagesSnap: any = { docs: [], size: 0 };

      try { productsSnap = await getDocs(query(collection(db, 'products'), where('companyId', '==', company.id))); } catch (e) { console.warn('ChatCtx: Products', e); }
      try { ordersSnap = await getDocs(query(collection(db, 'orders'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(30))); } catch (e) { console.warn('ChatCtx: Orders', e); }
      try { customersSnap = await getDocs(query(collection(db, 'customers'), where('companyId', '==', company.id))); } catch (e) { console.warn('ChatCtx: Customers', e); }
      try { remindersSnap = await getDocs(query(collection(db, 'reminders'), where('companyId', '==', company.id), where('status', '==', 'pending'), limit(10))); } catch (e) { console.warn('ChatCtx: Reminders', e); }
      try { messagesSnap = await getDocs(query(collection(db, 'customerMessages'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(10))); } catch (e) { console.warn('ChatCtx: Messages', e); }

      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const recentOrders = ordersSnap.docs.filter((d: any) => d.data().createdAt?.toDate() > last7Days);
      const prevOrders = ordersSnap.docs.filter((d: any) => d.data().createdAt?.toDate() <= last7Days && d.data().createdAt?.toDate() > prev7Days);
      const totalRevenue = ordersSnap.docs.reduce((acc: number, doc: any) => acc + (doc.data().totalAmount || 0), 0);
      const lowStockProducts = productsSnap.docs
        .map((d: any) => ({ id: d.id, name: d.data().name, stock: d.data().stockLevel }))
        .filter((p: any) => p.stock <= 10)
        .slice(0, 5);

      const customerOrders: Record<string, { count: number; total: number; name: string }> = {};
      ordersSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        if (!customerOrders[data.customerId]) {
          customerOrders[data.customerId] = { count: 0, total: 0, name: data.customerName || 'Unknown' };
        }
        customerOrders[data.customerId].count++;
        customerOrders[data.customerId].total += data.totalAmount || 0;
      });
      const topCustomers = Object.values(customerOrders).sort((a, b) => b.total - a.total).slice(0, 3);

      const context = {
        companyId: company.id,
        companyName: company.name,
        industry: company.industry,
        plan: (company as any).planLevel || 'starter',
        userRole: (user as any).role || 'staff',
        onboardingCompleted: (company as any).setupCompleted || false,
        customersCount: customersSnap.size,
        productsCount: productsSnap.size,
        recentRevenue: totalRevenue.toFixed(2),
        lowStockCount: lowStockProducts.length,
        salesVelocity: {
          currentPeriodOrders: recentOrders.length,
          previousPeriodOrders: prevOrders.length,
          trend: recentOrders.length >= prevOrders.length ? 'up' : 'down',
        },
        inventoryStatus: lowStockProducts,
        topCustomers,
        pendingReminders: remindersSnap.docs.map((d: any) => ({
          customer: d.data().customerName,
          type: d.data().type,
          due: d.data().dueDate,
          notes: d.data().notes,
        })),
        recentCommunications: messagesSnap.docs.map((d: any) => ({
          customer: d.data().customerName || 'Unknown',
          status: d.data().status,
          content: (d.data().content || '').slice(0, 30) + '...',
        })),
        operatorHistory: operatorHistory.slice(0, 3),
        summary: {
          products: productsSnap.docs.slice(0, 8).map((d: any) => ({ name: d.data().name, stock: d.data().stockLevel })),
          recentOrders: ordersSnap.docs.slice(0, 8).map((d: any) => ({ id: d.id.slice(0, 8), amount: d.data().totalAmount, customer: d.data().customerName })),
        },
      };

      const history = messages
        .filter(m => !m.streaming)
        .map(m => ({ role: m.role, parts: [{ text: m.text }] }));

      const aiResponse = await chatCopilot(textToSend, history, context, language);

      const userTriedToInject = /\[COMMAND:/i.test(textToSend);
      const commandMatch = !userTriedToInject
        ? aiResponse.match(/\[COMMAND:\s*([^|\]\n]+)\s*\|\s*([^\]]+)\]\s*$/)
        : null;

      const cleanText = commandMatch ? aiResponse.split('[COMMAND:')[0].trim() : aiResponse;

      let command: Message['command'] | undefined;
      if (commandMatch) {
        const type = commandMatch[1].trim();
        const params = commandMatch[2].trim();
        const isReviewOnly = ['DRAFT_REPORT', 'REVIEW_ONLY', 'DRAFT_ORDER'].includes(type) || params.length > 100;
        command = {
          type: type === 'NAVIGATE' && params.length > 50 ? 'REVIEW_ONLY' : type,
          params,
          summary: cleanText,
          isReviewOnly,
        };
      }

      const botMsgId = `m-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '',
        streaming: true,
        timestamp: new Date(),
        command,
        commandStatus: command ? 'pending' : undefined,
      }]);
      setIsTyping(false);

      simulateStreaming(botMsgId, cleanText);

      setOperatorHistory(prev => [{
        type: commandMatch ? 'COMMAND' : 'QUERY',
        action: textToSend,
        timestamp: new Date(),
      }, ...prev].slice(0, 10));
    } catch (error) {
      console.error('Chat error:', error);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model',
        text: 'I could not connect to the business data service. Please try again.',
        timestamp: new Date(),
      }]);
    }
  };

  const handleExecuteAction = async (msgId: string, command: Message['command']) => {
    if (!command) return;
    setActionProcessing(msgId);

    try {
      await new Promise(r => setTimeout(r, 700));

      if (command.isReviewOnly || ['DRAFT_REPORT', 'REVIEW_ONLY', 'DRAFT_ORDER'].includes(command.type)) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, commandStatus: 'executed' } : m));
        return;
      }

      if (command.type === 'NAVIGATE') {
        const targetPath = command.params.trim().toLowerCase().split('?')[0];
        const validRoutes = ['/dashboard', '/customers', '/products', '/inventory', '/orders', '/pos', '/insights', '/team', '/settings', '/billing'];
        const isValid = validRoutes.some(r => targetPath === r || targetPath.startsWith(r + '/'));
        if (!isValid) throw new Error(`Restricted target: ${targetPath}`);
        navigate(command.params.trim());
        setIsOpen(false);
      }

      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, commandStatus: 'executed' } : m));
    } catch (err: any) {
      console.error('Action execution failed:', err);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, commandStatus: 'dismissed' } : m));
    } finally {
      setActionProcessing(null);
    }
  };

  const openPanel = () => {
    setIsOpen(true);
    setUnreadInsights(0);
  };

  return (
    <>
      {/* Toast notification */}
      <AnimatePresence>
        {toast && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={cn(
              'fixed bottom-24 z-[60] max-w-[300px] bg-neutral-900 border border-white/10 rounded-2xl p-4 shadow-2xl cursor-pointer',
              isPOSRoute ? 'left-6 right-6 sm:right-auto' : 'right-6'
            )}
            onClick={openPanel}
          >
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <BrainCircuit className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">AI Insight</p>
                <p className="text-xs text-neutral-300 leading-relaxed line-clamp-3">{toast}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating trigger button */}
      <div className={cn('fixed bottom-6 z-[60]', isPOSRoute ? 'left-6' : 'right-6')}>
        <motion.button
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              openPanel();
            }
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 border',
            isOpen
              ? 'bg-neutral-800 border-white/10'
              : 'bg-blue-600 border-blue-400/30 shadow-blue-600/20'
          )}
        >
          {isOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <>
              <BrainCircuit className="w-6 h-6 text-white" />
              {unreadInsights > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 bg-blue-400 rounded-full text-[10px] font-black text-white flex items-center justify-center px-1 border-2 border-neutral-950">
                  {unreadInsights > 9 ? '9+' : unreadInsights}
                </span>
              )}
            </>
          )}
        </motion.button>
      </div>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[45]"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[440px] bg-neutral-950 border-l border-white/5 z-[50] flex flex-col shadow-[−20px_0_60px_rgba(0,0,0,0.6)]"
          >
            {/* ── Header ── */}
            <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.04]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
                    <BrainCircuit className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-white tracking-tight leading-tight">
                      {company?.name || 'AI Copilot'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <motion.span
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      />
                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        Live · ⌘K
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-all"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>

              {/* Live metrics strip */}
              {metrics && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    {
                      label: 'Revenue',
                      value: formatCurrency ? formatCurrency(metrics.revenue) : `$${metrics.revenue.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                      icon: TrendingUp,
                      accent: 'text-emerald-400',
                    },
                    {
                      label: 'Orders / 7d',
                      value: String(metrics.ordersThisWeek),
                      icon: Activity,
                      accent: 'text-blue-400',
                    },
                    {
                      label: 'Low Stock',
                      value: String(metrics.lowStockCount),
                      icon: Package,
                      accent: metrics.lowStockCount > 0 ? 'text-red-400' : 'text-neutral-500',
                    },
                  ].map(m => (
                    <div key={m.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2.5">
                      <m.icon className={cn('w-3.5 h-3.5 mb-1.5', m.accent)} />
                      <p className="text-sm font-bold text-white font-mono leading-tight">{m.value}</p>
                      <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest mt-0.5">{m.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs */}
              <div className="flex p-0.5 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                {[
                  { id: 'chat', label: 'Chat', icon: MessageSquare },
                  {
                    id: 'intel',
                    label: `Intel${unreadInsights > 0 ? ` · ${unreadInsights}` : ''}`,
                    icon: Zap,
                    dot: unreadInsights > 0,
                  },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      if (tab.id === 'intel') setUnreadInsights(0);
                    }}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-[11px] font-bold uppercase tracking-widest transition-all',
                      activeTab === tab.id
                        ? 'bg-white/[0.08] text-white'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {(tab as any).dot && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">

              {/* CHAT TAB */}
              {activeTab === 'chat' && (
                <>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* Empty state */}
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-6">
                        <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.05] flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-neutral-600" />
                        </div>
                        <div className="space-y-2 px-4">
                          <h4 className="text-white font-bold tracking-tight">Business Intelligence</h4>
                          <p className="text-neutral-500 text-sm leading-relaxed">
                            Ask me about your products, customers, inventory, or sales performance.
                          </p>
                        </div>
                        <div className="w-full space-y-2">
                          <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-3">Quick queries</p>
                          {[
                            { label: 'Daily summary', prompt: 'Give me a daily operational summary', icon: Activity },
                            { label: 'Best sellers', prompt: 'What are my best-selling products?', icon: TrendingUp },
                            { label: 'Low stock', prompt: 'Show me low stock products', icon: Package },
                            { label: 'Top customers', prompt: 'Who are my top customers?', icon: Users },
                          ].map(q => (
                            <button
                              key={q.label}
                              onClick={() => handleSendMessage(q.prompt)}
                              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-left hover:bg-white/[0.06] hover:border-blue-500/20 transition-all group"
                            >
                              <q.icon className="w-4 h-4 text-neutral-600 group-hover:text-blue-400 transition-colors shrink-0" />
                              <span className="text-sm text-neutral-400 group-hover:text-white transition-colors font-medium">{q.label}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-neutral-700 ml-auto group-hover:text-blue-400 transition-colors" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    {messages.map(m => (
                      <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[88%] rounded-2xl text-[13px] leading-relaxed',
                          m.role === 'user'
                            ? 'bg-blue-600 text-white px-4 py-3 rounded-br-md font-medium'
                            : 'bg-white/[0.03] border border-white/[0.07] text-neutral-300 px-4 py-3 rounded-bl-md'
                        )}>
                          {m.role === 'user' ? (
                            m.text
                          ) : (
                            <div>
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => {
                                    const text = typeof children === 'string' ? children : '';
                                    if (text && text === text.toUpperCase() && text.length > 5 && text.length < 40) {
                                      return <h5 className="text-[10px] font-black text-blue-400/80 tracking-[0.2em] mb-2 mt-4 first:mt-0 uppercase">{children}</h5>;
                                    }
                                    if (text && text.includes('ACTION_REQUIRED:')) return null;
                                    return <p className="mb-2.5 last:mb-0 text-neutral-300 leading-relaxed">{children}</p>;
                                  },
                                  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                                  ul: ({ children }) => <ul className="space-y-1.5 mb-3 last:mb-0">{children}</ul>,
                                  li: ({ children }) => (
                                    <li className="flex gap-2 items-start text-[13px] text-neutral-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40 mt-1.5 shrink-0" />
                                      <span>{children}</span>
                                    </li>
                                  ),
                                }}
                              >
                                {m.text}
                              </ReactMarkdown>

                              {/* Streaming cursor */}
                              {m.streaming && (
                                <span className="inline-block w-2 h-3.5 bg-blue-400 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
                              )}

                              {/* ACTION_REQUIRED inline buttons */}
                              {!m.streaming && m.text.includes('ACTION_REQUIRED:') && (
                                <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                                  {m.text.split('\n').map((line, li) => {
                                    if (!line.includes('ACTION_REQUIRED:')) return null;
                                    const action = line.split('ACTION_REQUIRED:')[1].trim();
                                    const mapping: Record<string, { label: string; path: string }> = {
                                      VIEW_INVENTORY: { label: 'Inventory', path: '/inventory' },
                                      VIEW_ORDERS: { label: 'Orders', path: '/orders' },
                                      VIEW_CUSTOMERS: { label: 'Customers', path: '/customers' },
                                      VIEW_INSIGHTS: { label: 'Insights', path: '/insights' },
                                    };
                                    const cfg = mapping[action];
                                    if (!cfg) return null;
                                    return (
                                      <button
                                        key={li}
                                        onClick={() => { setIsOpen(false); navigate(cfg.path); }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                                      >
                                        {cfg.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Inline command card */}
                              {!m.streaming && m.command && m.commandStatus === 'pending' && (
                                <div className="mt-3 pt-3 border-t border-white/5">
                                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                        {m.command.isReviewOnly ? 'Review Ready' : 'Action Ready'} · {m.command.type.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleExecuteAction(m.id, m.command)}
                                        disabled={actionProcessing === m.id}
                                        className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                      >
                                        {actionProcessing === m.id ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                        {m.command.isReviewOnly ? 'Acknowledge' : 'Execute'}
                                      </button>
                                      <button
                                        onClick={() => setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, commandStatus: 'dismissed' } : msg))}
                                        className="px-4 py-2 rounded-lg bg-white/5 text-neutral-400 text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {!m.streaming && m.command && m.commandStatus === 'executed' && (
                                <div className="mt-2 flex items-center gap-1.5 text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Executed</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Typing indicator (only when no streaming message exists) */}
                    {isTyping && !messages.some(m => m.streaming) && (
                      <div className="flex justify-start">
                        <div className="bg-white/[0.03] border border-white/[0.07] px-4 py-3 rounded-2xl rounded-bl-md">
                          <div className="flex gap-1.5">
                            <span className="w-1.5 h-1.5 bg-blue-400/50 rounded-full animate-bounce" />
                            <span className="w-1.5 h-1.5 bg-blue-400/50 rounded-full animate-bounce [animation-delay:0.15s]" />
                            <span className="w-1.5 h-1.5 bg-blue-400/50 rounded-full animate-bounce [animation-delay:0.3s]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input bar */}
                  <div className="flex-shrink-0 p-4 border-t border-white/[0.04] bg-neutral-950">
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !isTyping && handleSendMessage()}
                        placeholder="Ask anything about your business..."
                        className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                      />
                      <button
                        onClick={() => handleSendMessage()}
                        disabled={!inputText.trim() || isTyping}
                        className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 shadow-lg shadow-blue-600/20"
                      >
                        <Send className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    {messages.length > 0 && (
                      <button
                        onClick={() => {
                          setMessages([]);
                          if (company) localStorage.removeItem(`copilot_messages_${company.id}`);
                        }}
                        className="mt-2 text-[10px] text-neutral-700 hover:text-neutral-500 font-bold uppercase tracking-widest transition-colors w-full text-center"
                      >
                        Clear conversation
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* INTEL TAB */}
              {activeTab === 'intel' && (
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
                  {insights.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-4">
                      <div className="w-12 h-12 rounded-2xl border border-dashed border-white/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-neutral-700" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-neutral-500">No insights yet</p>
                        <p className="text-xs text-neutral-700">AI generates insights every 2 minutes from your live data.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] font-black text-neutral-700 uppercase tracking-widest px-1">
                        {insights.length} AI observation{insights.length !== 1 ? 's' : ''}
                      </p>
                      {insights.map(ins => (
                        <motion.div
                          key={ins.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all group"
                        >
                          <div className="flex gap-3">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <BrainCircuit className="w-3.5 h-3.5 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-neutral-200 leading-relaxed">{ins.text}</p>
                              <div className="flex items-center justify-between mt-2.5">
                                <span className="text-[10px] font-mono text-neutral-700">
                                  {format(ins.timestamp, 'HH:mm')} · AI Copilot
                                </span>
                                {ins.priority === 'high' && (
                                  <span className="text-[9px] font-black uppercase tracking-widest text-red-400 border border-red-500/20 bg-red-500/5 px-2 py-0.5 rounded-full">
                                    High Priority
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setActiveTab('chat');
                                  handleSendMessage(`Tell me more about this insight: "${ins.text.slice(0, 100)}"`);
                                }}
                                className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Ask follow-up
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Suggested actions based on insights */}
                      <div className="pt-4 border-t border-white/[0.04] space-y-2">
                        <p className="text-[10px] font-black text-neutral-700 uppercase tracking-widest px-1 mb-3">Suggested Actions</p>
                        {[
                          { label: 'Performance report', prompt: 'Draft a weekly performance summary and revenue report.', icon: TrendingUp },
                          { label: 'Inventory check', prompt: 'Check inventory for low stock items and prepare a restock plan.', icon: Package },
                          { label: 'Customer review', prompt: 'Review recent customer activity and identify loyalty opportunities.', icon: Users },
                        ].map(a => (
                          <button
                            key={a.label}
                            onClick={() => { setActiveTab('chat'); handleSendMessage(a.prompt); }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-left hover:bg-white/[0.05] hover:border-blue-500/20 transition-all group"
                          >
                            <a.icon className="w-4 h-4 text-neutral-600 group-hover:text-blue-400 transition-colors shrink-0" />
                            <span className="text-sm text-neutral-500 group-hover:text-white transition-colors font-medium flex-1">{a.label}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-700 group-hover:text-blue-400 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

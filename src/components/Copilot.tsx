import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  AlertCircle, 
  ChevronRight, 
  MessageSquare, 
  Activity, 
  ArrowUpRight, 
  TrendingUp, 
  Package, 
  Users, 
  BrainCircuit,
  Zap,
  Info,
  LayoutList,
  ShieldCheck,
  FileText,
  ArrowRight,
  RefreshCcw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { chatCopilot } from '../services/gemini';
import { cn } from './Common';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useLocale } from '../hooks/useLocale';

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  actionLabel?: string;
  actionLink?: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export function Copilot() {
  const { company, user } = useAuth();
  const { t, language, formatCurrency } = useLocale();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'briefing' | 'actions'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'All' | 'Inventory' | 'Customers' | 'Orders' | 'Reports'>('All');
  const [operatorHistory, setOperatorHistory] = useState<{ type: string, summary: Date, action: string }[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [historyItems, setHistoryItems] = useState<{ query: string, timestamp: Date }[]>([]);
  const [pendingAction, setPendingAction] = useState<{ 
    type: string, 
    params: string, 
    summary: string,
    isReviewOnly?: boolean 
  } | null>(null);
  const [actionStatus, setActionStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [hasNewAlerts, setHasNewAlerts] = useState(false);
  const [businessContext, setBusinessContext] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleIntervention = (prompt: string) => {
    setActiveTab('chat');
    handleSendMessage(prompt);
  };

  // Background Monitoring Logic (Hybrid: Rule-based + State)
  useEffect(() => {
    if (!company) return;
    
    // Load local history if any
    const storedHistory = localStorage.getItem(`copilot_history_${company.id}`);
    if (storedHistory) {
      try {
        setHistoryItems(JSON.parse(storedHistory).map((h: any) => ({ ...h, timestamp: new Date(h.timestamp) })));
      } catch (e) {
        console.error("History parse error", e);
      }
    }

    // Simulate background monitoring
    const runMonitoring = async () => {
      const newAlerts: Alert[] = [];
      
      try {
        let productsSnap: any = { docs: [], size: 0 };
        let ordersSnap: any = { docs: [], size: 0 };
        let customersSnap: any = { docs: [], size: 0 };
        let remindersSnap: any = { docs: [], size: 0 };

        try { productsSnap = await getDocs(query(collection(db, 'products'), where('companyId', '==', company.id))); } catch (e) { console.warn("Monitoring: Products fetch failed", e); }
        try { ordersSnap = await getDocs(query(collection(db, 'orders'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(30))); } catch (e) { console.warn("Monitoring: Orders fetch failed", e); }
        try { customersSnap = await getDocs(query(collection(db, 'customers'), where('companyId', '==', company.id))); } catch (e) { console.warn("Monitoring: Customers fetch failed", e); }
        try { remindersSnap = await getDocs(query(collection(db, 'reminders'), where('companyId', '==', company.id), where('status', '==', 'pending'))); } catch (e) { console.warn("Monitoring: Reminders fetch failed", e); }

        // Metrics Calculation
        const now = new Date();
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const recentOrders = ordersSnap.docs.filter(d => d.data().createdAt?.toDate() > last7Days);
        const prevOrders = ordersSnap.docs.filter(d => d.data().createdAt?.toDate() <= last7Days && d.data().createdAt?.toDate() > prev7Days);
        const totalRevenue = ordersSnap.docs.reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0);
        
        const lowStockProducts = productsSnap.docs
          .map(d => ({ id: d.id, name: d.data().name, stock: d.data().stockLevel }))
          .filter(p => p.stock <= 10);

        // Alerts Logic
        if (lowStockProducts.length > 0) {
          newAlerts.push({
            id: 'low-stock-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            type: 'warning',
            title: 'Inventory Stabilization Needed',
            message: `${lowStockProducts.length} assets are at critical supply levels. Restock required.`,
            timestamp: new Date(),
            actionLabel: 'Go to Inventory',
            actionLink: '/inventory'
          });
        }

        // Update overall context state
        setBusinessContext({
            revenue: totalRevenue,
            lowStockCount: lowStockProducts.length,
            velocity: recentOrders.length >= prevOrders.length ? 'positive' : 'negative',
            customerCount: customersSnap.size,
            productCount: productsSnap.size
        });

        // 2. Recent Sales Spike (Rule-based)
        const ordersRef = collection(db, 'orders');
        const recentOrdersQuery = query(ordersRef, where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(5));
        const recentOrdersSnap = await getDocs(recentOrdersQuery);
        if (recentOrdersSnap.size >= 3) {
            const latest = recentOrdersSnap.docs[0].data();
            if (latest.totalAmount > 500) {
                newAlerts.push({
                    id: 'high-value-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                    type: 'success',
                    title: 'High-Value Influx',
                    message: `A significant transaction of $${latest.totalAmount} was processed. Client vector identified.`,
                    timestamp: new Date(),
                    actionLabel: 'View Order',
                    actionLink: '/orders'
                });
            }
        }

        // 3. New Customer Detection
        const latestCustomersQuery = query(collection(db, 'customers'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(1));
        const latestCustomerSnap = await getDocs(latestCustomersQuery);
        if (!latestCustomerSnap.empty) {
            const customer = latestCustomerSnap.docs[0].data();
            const createdAt = customer.createdAt?.toDate();
            // If created within the last 24 hours (for demo, maybe last 5 mins if we want real-time feeling, but let's stick to recent)
            if (createdAt && (Date.now() - createdAt.getTime()) < 3600000 * 24) {
                newAlerts.push({
                    id: 'new-customer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                    type: 'info',
                    title: 'New Client Vector',
                    message: `${customer.name} has entered the business environment. Engagement recommended.`,
                    timestamp: new Date(),
                    actionLabel: 'View Profile',
                    actionLink: '/customers'
                });
            }
        }

        // 4. Pending Reminders Detection
        if (remindersSnap.size > 0) {
          const urgent = remindersSnap.docs.filter(d => {
            const dueDate = new Date(d.data().dueDate);
            return dueDate <= new Date();
          });
          if (urgent.length > 0) {
            newAlerts.push({
              id: 'urgent-reminders-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
              type: 'warning',
              title: 'Operational Follow-ups Due',
              message: `You have ${urgent.length} urgent customer follow-up actions requiring review.`,
              timestamp: new Date(),
              actionLabel: 'Check Customers',
              actionLink: '/customers'
            });
          }
        }

        if (newAlerts.length > 0) {
          setAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
          setHasNewAlerts(true);
        }
      } catch (error) {
        const { handleFirestoreError, OperationType } = await import('../lib/firebase');
        try {
          handleFirestoreError(error, OperationType.LIST, 'monitoring-batch');
        } catch (e) {
          // Fallback to simple log if the formatted error fails
          console.error("Monitoring Error:", error);
        }
      }
    };

    runMonitoring();
    const interval = setInterval(runMonitoring, 60000 * 5); // Every 5 minutes
    return () => clearInterval(interval);
  }, [company?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if (!textToSend.trim() || !company) return;

    const userMessage = textToSend.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    if (!overrideText) setInputText('');
    setIsTyping(true);

    try {
      // Gather context for AI
      let productsSnap: any = { docs: [], size: 0 };
      let ordersSnap: any = { docs: [], size: 0 };
      let customersSnap: any = { docs: [], size: 0 };
      let remindersSnap: any = { docs: [], size: 0 };
      let messagesSnap: any = { docs: [], size: 0 };

      try { productsSnap = await getDocs(query(collection(db, 'products'), where('companyId', '==', company.id))); } catch (e) { console.warn("ChatContext: Products fetch failed", e); }
      try { ordersSnap = await getDocs(query(collection(db, 'orders'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(30))); } catch (e) { console.warn("ChatContext: Orders fetch failed", e); }
      try { customersSnap = await getDocs(query(collection(db, 'customers'), where('companyId', '==', company.id))); } catch (e) { console.warn("ChatContext: Customers fetch failed", e); }
      try { remindersSnap = await getDocs(query(collection(db, 'reminders'), where('companyId', '==', company.id), where('status', '==', 'pending'), limit(10))); } catch (e) { console.warn("ChatContext: Reminders fetch failed", e); }
      try { messagesSnap = await getDocs(query(collection(db, 'customerMessages'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(10))); } catch (e) { console.warn("ChatContext: Messages fetch failed", e); }

      // Calculate Metrics
      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const recentOrders = ordersSnap.docs.filter(d => d.data().createdAt?.toDate() > last7Days);
      const prevOrders = ordersSnap.docs.filter(d => d.data().createdAt?.toDate() <= last7Days && d.data().createdAt?.toDate() > prev7Days);
      
      const totalRevenue = ordersSnap.docs.reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0);
      const lowStockProducts = productsSnap.docs
        .map(d => ({ id: d.id, name: d.data().name, stock: d.data().stockLevel }))
        .filter(p => p.stock <= 10)
        .slice(0, 5);

      // Customer analysis
      const customerOrders: Record<string, { count: number, total: number, name: string }> = {};
      ordersSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!customerOrders[data.customerId]) {
            customerOrders[data.customerId] = { count: 0, total: 0, name: data.customerName || 'Unknown' };
        }
        customerOrders[data.customerId].count++;
        customerOrders[data.customerId].total += data.totalAmount || 0;
      });

      const topCustomers = Object.values(customerOrders)
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      const context = {
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
            trend: recentOrders.length >= prevOrders.length ? 'up' : 'down'
        },
        inventoryStatus: lowStockProducts,
        topCustomers,
        pendingReminders: remindersSnap.docs.map(d => ({ 
            customer: d.data().customerName, 
            type: d.data().type, 
            due: d.data().dueDate,
            notes: d.data().notes
        })),
        recentCommunications: messagesSnap.docs.map(d => ({ 
            customer: d.data().customerName || 'Unknown', 
            status: d.data().status, 
            content: d.data().content.slice(0, 30) + '...'
        })),
        operatorHistory: operatorHistory.slice(0, 3), // Pass recent actions for continuity
        summary: {
            products: productsSnap.docs.slice(0, 8).map(d => ({ name: d.data().name, stock: d.data().stockLevel })),
            recentOrders: ordersSnap.docs.slice(0, 8).map(d => ({ id: d.id.slice(0, 8), amount: d.data().totalAmount, customer: d.data().customerName }))
        }
      };

      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const aiResponse = await chatCopilot(userMessage, history, context, language);
      
      // Improved multi-line and strict parsing for [COMMAND: TYPE | PARAMS]
      const commandMatch = aiResponse.match(/\[COMMAND:\s*([^|\]\n]+)\s*\|\s*([^\]]+)\]/);
      if (commandMatch) {
         const type = commandMatch[1].trim();
         const params = commandMatch[2].trim();
         
         // Basic heuristics to double-check if AI put a report inside NAVIGATE
         const isReviewOnly = ['DRAFT_REPORT', 'REVIEW_ONLY', 'DRAFT_ORDER'].includes(type) || params.length > 100;
         const finalType = (type === 'NAVIGATE' && params.length > 50) ? 'REVIEW_ONLY' : type;

         setPendingAction({
            type: finalType,
            params,
            summary: aiResponse.split('[COMMAND:')[0].trim(),
            isReviewOnly
         });
         setActiveTab('actions');
      }

      setMessages(prev => [...prev, { role: 'model', text: aiResponse }]);

      // Update operator history
      setOperatorHistory(prev => [{ 
        type: commandMatch ? 'COMMAND' : 'QUERY', 
        summary: new Date(), 
        action: userMessage 
      }, ...prev].slice(0, 10));

      // Update history
      const newHistory = [{ query: userMessage, timestamp: new Date() }, ...historyItems].slice(0, 5);
      setHistoryItems(newHistory);
      localStorage.setItem(`copilot_history_${company.id}`, JSON.stringify(newHistory));
    } catch (error) {
      const { handleFirestoreError, OperationType } = await import('../lib/firebase');
      try {
        handleFirestoreError(error, OperationType.LIST, 'chat-context-fetch');
      } catch (e) {
        console.error("Chat Error:", error);
      }
      setMessages(prev => [...prev, { role: 'model', text: "Operation failed. I am unable to connect to the business data service at this time." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!pendingAction) return;
    
    setActionStatus('processing');
    setActionError(null);

    try {
      // Small artificial delay for visual feedback in premium UI
      await new Promise(resolve => setTimeout(resolve, 800));

      const { type, params, isReviewOnly } = pendingAction;

      if (isReviewOnly || ['DRAFT_REPORT', 'REVIEW_ONLY', 'DRAFT_ORDER'].includes(type)) {
        // These are strictly for human acknowledgement in this version
        setActionStatus('success');
        await new Promise(resolve => setTimeout(resolve, 800));
        setPendingAction(null);
        setActionStatus('idle');
        return;
      }

      if (type === 'NAVIGATE') {
        const targetPath = params.trim().toLowerCase().split('?')[0];
        const validRoutes = ['/dashboard', '/customers', '/products', '/inventory', '/orders', '/insights', '/team', '/settings', '/billing'];
        
        // Stricter route validation
        const isValid = validRoutes.some(route => targetPath === route || targetPath.startsWith(route + '/'));
        
        if (!isValid && targetPath !== '/') {
          throw new Error(`Restricted navigation target: ${targetPath}`);
        }

        navigate(params.trim());
        setActionStatus('success');
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsOpen(false);
      } else if (type === 'OPEN_FILTER' || type === 'EXECUTE_SAFE_ACTION') {
        // Mock success for these protocols as they require specific page-level listeners
        setActionStatus('success');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error(`Command protocol [${type}] is not currently executable.`);
      }

      setOperatorHistory(prev => [{ 
        type: pendingAction.type, 
        action: pendingAction.params, 
        summary: new Date() 
      }, ...prev].slice(0, 10));
      
      setPendingAction(null);
      setActionStatus('idle');
    } catch (err: any) {
      console.error("Action Execution Failed:", err);
      setActionStatus('error');
      setActionError(err.message || "Command execution failure.");
      
      // Auto-revert to idle after delay
      setTimeout(() => {
        setActionStatus('idle');
        setActionError(null);
      }, 3000);
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setHasNewAlerts(false);
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-8 right-8 z-[100]">
        <motion.button
          onClick={toggleOpen}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "w-16 h-16 rounded-3xl flex items-center justify-center relative overflow-hidden shadow-2xl transition-all duration-500",
            isOpen 
              ? "bg-neutral-800 rotate-90 border border-white/10" 
              : "bg-blue-600 border border-blue-400/50"
          )}
        >
          {isOpen ? (
            <X className="w-8 h-8 text-white -rotate-90" />
          ) : (
            <>
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0, 0.15, 0]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-white"
              />
              <Bot className="w-8 h-8 text-white relative z-10" />
              {hasNewAlerts && (
                <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-blue-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              )}
            </>
          )}
        </motion.button>
      </div>

      {/* Copilot Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            className="fixed bottom-0 right-0 sm:bottom-28 sm:right-8 w-full sm:w-[400px] h-full sm:h-[80vh] sm:max-h-[700px] bg-neutral-900 border-t sm:border border-white/10 sm:rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[100] flex flex-col overflow-hidden backdrop-blur-3xl"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.03] bg-white/[0.01]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-display font-bold text-white tracking-tight text-lg">{t('common.view_assistant')}</h3>
                    <div className="flex items-center gap-2">
                        <motion.span 
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                        />
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.system_status')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all group hidden sm:block">
                     <Zap className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                  </button>
                  <button 
                    onClick={toggleOpen}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all sm:hidden"
                  >
                    <X className="w-5 h-5 text-neutral-400" />
                  </button>
                </div>
              </div>

              {/* Tabs - Premium Segmented Control */}
              <div className="flex p-1 bg-black/40 rounded-xl border border-white/[0.05] overflow-x-auto scrollbar-hide">
                {[
                  { id: 'chat', icon: MessageSquare, label: 'Assistant' },
                  { id: 'briefing', icon: LayoutList, label: 'Briefing', notify: hasNewAlerts },
                  { id: 'actions', icon: Zap, label: 'History' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.15em] transition-all duration-300",
                      activeTab === tab.id 
                        ? "bg-white/[0.08] text-white shadow-sm ring-1 ring-white/10" 
                        : "text-neutral-500 hover:text-neutral-300"
                    )}
                  >
                    <tab.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="truncate">{tab.label}</span>
                    {tab.notify && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-500 ml-0.5 animate-pulse shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
              <div 
                ref={scrollRef}
                className="h-full overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar"
              >
                {activeTab === 'chat' && (
                  <>
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-4">
                        <div className="space-y-4">
                          <div className="w-20 h-20 bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.05] rounded-[2.5rem] flex items-center justify-center mx-auto">
                            <Sparkles className="w-10 h-10 text-neutral-500" />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-white font-bold text-lg tracking-tight">Active Business Intelligence</h4>
                            <p className="text-neutral-500 text-sm px-8 leading-relaxed font-medium">
                              How can I assist your operations today? I can analyze high-performing products, customer patterns, or inventory risks.
                            </p>
                          </div>
                        </div>

                        <div className="w-full max-w-[320px] space-y-4">
                           <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest text-center mb-1">Operational Summaries</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => handleIntervention("Provide a daily operational summary")}
                                className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.05] text-[10px] font-bold text-white hover:bg-blue-600/10 hover:border-blue-500/30 transition-all flex items-center justify-center gap-2"
                              >
                                <Activity className="w-3.5 h-3.5 text-blue-500" /> Daily Sync
                              </button>
                              <button 
                                onClick={() => handleIntervention("Provide a weekly business overview")}
                                className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.05] text-[10px] font-bold text-white hover:bg-emerald-600/10 hover:border-emerald-500/30 transition-all flex items-center justify-center gap-2"
                              >
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Weekly Scan
                              </button>
                            </div>
                           </div>

                           <div className="space-y-3">
                            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest text-center mb-1">Quick Queries</p>
                            <div className="flex flex-wrap justify-center gap-2">
                             {[
                               "Best-selling products",
                               "Low stock items",
                               "Top customers"
                             ].map(q => (
                               <button 
                                  key={q}
                                  onClick={() => setInputText(q)}
                                  className="px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] font-bold text-neutral-400 hover:bg-blue-600/10 hover:border-blue-500/30 hover:text-white transition-all active:scale-95"
                               >
                                 {q}
                               </button>
                             ))}
                            </div>
                           </div>
                        </div>
                      </div>
                    )}
                    
                    {messages.map((m, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "flex w-full",
                          m.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[90%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                          m.role === 'user' 
                            ? "bg-blue-600 text-white rounded-br-none font-medium" 
                            : "bg-white/[0.03] border border-white/10 text-neutral-300 rounded-bl-none"
                        )}>
                          {m.role === 'user' ? (
                            m.text
                          ) : (
                            <div className="ai-message-content">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => {
                                    const text = typeof children === 'string' ? children : '';
                                    if (text && text === text.toUpperCase() && text.length > 5 && text.length < 40) {
                                      return <h5 className="text-[10px] font-black text-blue-500/80 tracking-[0.2em] mb-2 mt-4 first:mt-0 uppercase">{children}</h5>;
                                    }
                                    if (text && text.includes('ACTION_REQUIRED:')) return null;
                                    return <p className="mb-3 last:mb-0 text-neutral-300 leading-relaxed">{children}</p>;
                                  },
                                  strong: ({ children }) => <strong className="font-bold text-white tracking-tight">{children}</strong>,
                                  ul: ({ children }) => <ul className="space-y-1.5 mb-4 last:mb-0 list-none pl-0">{children}</ul>,
                                  li: ({ children }) => (
                                    <li className="flex gap-2.5 items-start text-[13px] text-neutral-400">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
                                      <span>{children}</span>
                                    </li>
                                  ),
                                }}
                              >
                                {m.text}
                              </ReactMarkdown>

                              {/* Action Buttons Parsing */}
                              {m.text.includes('ACTION_REQUIRED:') && (
                                <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                                  {m.text.split('\n').map(line => {
                                    if (!line.includes('ACTION_REQUIRED:')) return null;
                                    const action = line.split('ACTION_REQUIRED:')[1].trim();
                                    const mapping: Record<string, { label: string, path: string, icon: any }> = {
                                      'VIEW_INVENTORY': { label: 'Go to Inventory', path: '/inventory', icon: Package },
                                      'VIEW_ORDERS': { label: 'Review Orders', path: '/orders', icon: MessageSquare },
                                      'VIEW_CUSTOMERS': { label: 'See Customers', path: '/customers', icon: Users },
                                      'VIEW_INSIGHTS': { label: 'Analyze Deep Scan', path: '/insights', icon: Sparkles }
                                    };
                                    const config = mapping[action];
                                    if (!config) return null;
                                    return (
                                      <button 
                                        key={action}
                                        onClick={() => { setIsOpen(false); navigate(config.path); }}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                                      >
                                        <config.icon className="w-3 h-3" />
                                        {config.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl rounded-bl-none">
                           <div className="flex gap-1.5 px-1 py-0.5">
                              <span className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce" />
                              <span className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                              <span className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                           </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'actions' && (
                  <div className="space-y-6">
                    {pendingAction ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          "p-6 rounded-[2.5rem] border transition-all duration-500",
                          actionStatus === 'error' ? "bg-red-500/10 border-red-500/30" : 
                          actionStatus === 'success' ? "bg-emerald-500/10 border-emerald-500/30" :
                          "bg-blue-600 shadow-xl shadow-blue-600/20 border-transparent"
                        )}
                      >
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                  actionStatus === 'error' ? "bg-red-500 text-white" :
                                  actionStatus === 'success' ? "bg-emerald-500 text-white" :
                                  "bg-white/20 text-white"
                                )}>
                                   {actionStatus === 'processing' ? <RefreshCcw className="w-5 h-5 animate-spin" /> : (pendingAction.isReviewOnly ? <FileText className="w-5 h-5" /> : <Zap className="w-5 h-5" />)}
                                </div>
                                <div>
                                   <h4 className="text-white font-bold text-[14px] tracking-tight">
                                     {actionStatus === 'processing' ? 'Processing...' : 
                                      actionStatus === 'error' ? 'Invalid Protocol' :
                                      actionStatus === 'success' ? 'Execution Valid' :
                                      (pendingAction.isReviewOnly ? 'Review Required' : 'Command Ready')}
                                   </h4>
                                   <p className="text-white/60 text-[9px] font-black uppercase tracking-widest leading-none mt-1">
                                     {pendingAction.type.replace('_', ' ')}
                                   </p>
                                </div>
                            </div>
                         </div>

                         <div className="bg-black/20 rounded-2xl p-4 mb-6">
                            <div className="text-[11px] text-white/90 leading-relaxed font-medium">
                               <ReactMarkdown
                                 components={{
                                   p: ({ children }) => <p className="mb-0 italic truncate max-h-20 overflow-hidden line-clamp-3">"{children}"</p>,
                                   strong: ({ children }) => <span className="font-bold">{children}</span>,
                                 }}
                               >
                                 {pendingAction.summary.replace(/[#*]/g, '')}
                               </ReactMarkdown>
                            </div>
                            {actionStatus === 'error' && (
                              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-red-100">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">{actionError}</span>
                              </div>
                            )}
                         </div>

                         <div className="flex gap-3">
                           <button 
                             onClick={handleExecuteAction}
                             disabled={actionStatus === 'processing' || actionStatus === 'success'}
                             className={cn(
                               "flex-[2] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50",
                               actionStatus === 'error' ? "bg-white text-red-600" : "bg-white text-blue-600 hover:bg-neutral-100"
                             )}
                           >
                               {actionStatus === 'processing' ? 'Syncing...' : (pendingAction.isReviewOnly ? 'Acknowledge' : 'Execute')}
                           </button>
                           <button 
                             onClick={() => {
                               setPendingAction(null);
                               setActionStatus('idle');
                             }}
                             disabled={actionStatus === 'processing'}
                             className="flex-1 py-4 rounded-2xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all disabled:opacity-50"
                           >
                               Dismiss
                           </button>
                         </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-6">
                        <div className="px-2 space-y-4">
                           {/* Category Scopes */}
                           <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                            {['All', 'Inventory', 'Customers', 'Orders', 'Reports'].map(cat => (
                              <button
                                key={cat}
                                onClick={() => setActiveCategory(cat as any)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border",
                                  activeCategory === cat 
                                    ? "bg-blue-600 border-blue-400 text-white" 
                                    : "bg-white/[0.03] border-white/5 text-neutral-500 hover:text-neutral-400"
                                )}
                              >
                                {cat}
                              </button>
                            ))}
                           </div>
                        </div>
                        
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 gap-2.5">
                             <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2">Operational Scopes</p>
                             {[
                               { q: "Show low stock products", desc: "Scan inventory for risks", icon: Package, cat: 'Inventory' },
                               { q: "Show my customers", desc: "Access customer registry", icon: Users, cat: 'Customers' },
                               { q: "Go to latest orders", desc: "Review processing queue", icon: TrendingUp, cat: 'Orders' },
                               { q: "Draft a inventory report", desc: "Synthesize summary data", icon: Sparkles, cat: 'Reports' }
                             ]
                              .filter(i => activeCategory === 'All' || i.cat === activeCategory)
                              .map(item => (
                               <button 
                                  key={item.q}
                                  onClick={() => {
                                    setInputText(item.q);
                                    setActiveTab('chat');
                                    setTimeout(handleSendMessage, 100);
                                  }}
                                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all text-left group"
                               >
                                  <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all shrink-0">
                                     <item.icon className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-white font-bold text-[13px] tracking-tight leading-tight">{item.q}</p>
                                    <p className="text-[11px] text-neutral-500 font-medium truncate mt-0.5">{item.desc}</p>
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-neutral-700 ml-auto group-hover:text-blue-500 transition-colors" />
                               </button>
                              ))}
                          </div>
                        </div>

                        {/* Consolidated Activity Log Section */}
                        {operatorHistory.length > 0 && (
                          <div className="mt-8 space-y-6">
                            <div className="flex items-center justify-between px-2">
                               <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Activity Log</span>
                               <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOperatorHistory([]);
                                }} 
                                className="text-[9px] font-bold text-neutral-700 hover:text-red-500 uppercase tracking-widest transition-colors"
                               >
                                Clear Logs
                               </button>
                            </div>
                            <div className="space-y-3 px-2">
                              {operatorHistory.map((h, idx) => (
                                <div key={idx} className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] flex items-center justify-between group">
                                   <div className="flex items-center gap-3">
                                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
                                      <div className="min-w-0">
                                         <p className="text-[11px] text-neutral-300 font-bold uppercase tracking-tight">{h.type}</p>
                                         <p className="text-[10px] text-neutral-500 truncate max-w-[180px]">{h.action}</p>
                                      </div>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[9px] font-mono text-neutral-700 uppercase">SYNC_OK</p>
                                   </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {operatorHistory.length === 0 && (
                          <div className="py-20 text-center text-neutral-600 space-y-4">
                             <Zap className="w-8 h-8 mx-auto opacity-20" />
                             <p className="text-xs font-medium italic">No historical commands recorded.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'briefing' && (
                  <div className="space-y-6 pb-6">
                    {/* Environment Sync Status */}
                    <div className="p-6 rounded-[2.5rem] bg-blue-600/[0.03] border border-blue-500/10 relative overflow-hidden group">
                       <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                            <Activity className="w-4 h-4" />
                          </div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-blue-400">System Status</p>
                       </div>
                       <div className="space-y-4">
                         <p className="text-sm text-neutral-400 leading-relaxed font-medium">
                           {businessContext ? (
                             <>
                               Current insights for <b>{company.name}</b> indicate <b>{businessContext.velocity}</b> activity levels. 
                               Managing <b>{businessContext.productCount}</b> items across <b>{businessContext.customerCount}</b> customer accounts.
                             </>
                           ) : (
                             "Synchronizing business metrics..."
                           )}
                         </p>
                       </div>
                    </div>

                    {/* Operational Alerts */}
                    <div className="space-y-3">
                       <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2">Operational Insights</p>
                       {alerts.length === 0 ? (
                         <div className="p-8 rounded-[2rem] border border-dashed border-white/5 bg-white/[0.01] text-center">
                            <ShieldCheck className="w-8 h-8 text-neutral-700 mx-auto mb-3 opacity-50" />
                            <p className="text-xs text-neutral-500 italic">No operational deviance detected.</p>
                         </div>
                       ) : (
                         <div className="space-y-3">
                           {alerts.map(alert => (
                             <div key={alert.id} className={cn(
                               "p-5 rounded-[2rem] border transition-all hover:bg-white/[0.02] cursor-pointer group",
                               alert.type === 'warning' ? "bg-red-500/[0.02] border-red-500/10" : "bg-emerald-500/[0.02] border-emerald-500/10"
                             )}
                             onClick={() => { if (alert.actionLink) { navigate(alert.actionLink); setIsOpen(false); } }}
                             >
                                <div className="flex gap-4">
                                   <div className={cn(
                                     "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                                      alert.type === 'warning' ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                   )}>
                                      {alert.type === 'warning' ? <AlertCircle className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                   </div>
                                   <div className="min-w-0 pr-2">
                                      <h4 className="text-[13px] font-bold text-white tracking-tight">{alert.title}</h4>
                                      <p className="text-[11px] text-neutral-500 leading-relaxed font-medium line-clamp-2">{alert.message}</p>
                                   </div>
                                </div>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>

                    {/* Suggested Actions */}
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2">Suggested Actions</p>
                       <div className="grid grid-cols-1 gap-3">
                          {[
                            { 
                              id: 'summary', 
                              label: 'Performance Briefing', 
                              desc: 'Synthesize revenue vectors and generate report.',
                              icon: TrendingUp,
                              prompt: 'Draft a weekly performance summary and status report.'
                            },
                            { 
                              id: 'inventory', 
                              label: 'Inventory Stabilize', 
                              desc: 'Analyze low stock and prepare restock draft.',
                              icon: Package,
                              prompt: 'Check inventory for low stock items and prepare a restock draft.'
                            },
                            { 
                              id: 'customers', 
                              label: 'Client Sentiment', 
                              desc: 'Review market nodes and activity levels.',
                              icon: Users,
                              prompt: 'Review recent customer activity and identify loyalty opportunities.'
                            }
                          ].map(action => (
                            <button 
                              key={action.id}
                              onClick={() => handleIntervention(action.prompt)}
                              className="flex items-start gap-4 p-5 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] hover:border-blue-500/30 hover:bg-blue-500/[0.03] transition-all group text-left"
                            >
                               <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-neutral-500 group-hover:text-blue-500 group-hover:border-blue-500/30 transition-all shrink-0">
                                  <action.icon className="w-5 h-5" />
                               </div>
                               <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white mb-1">{action.label}</p>
                                  <p className="text-[10px] text-neutral-500 leading-relaxed font-medium">{action.desc}</p>
                               </div>
                            </button>
                          ))}
                       </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Input Bar */}
            {activeTab === 'chat' && (
              <div className="px-4 sm:px-6 py-4 sm:py-7 border-t border-white/[0.03] bg-white/[0.01]">
                <div className="relative flex items-center gap-2 sm:gap-3">
                  <div className="relative flex-1 group">
                    <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <input 
                      type="text"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask query..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 relative z-10 transition-all font-medium"
                    />
                  </div>
                  <button 
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isTyping}
                    className="w-12 h-12 sm:w-14 sm:h-14 bg-white text-black rounded-2xl flex items-center justify-center hover:bg-neutral-200 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 relative z-20 shadow-xl"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

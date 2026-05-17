import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BrainCircuit,
  X,
  Send,
  Zap,
  TrendingUp,
  Package,
  Users,
  Activity,
  Sparkles,
  ChevronRight,
  MessageSquare,
  RefreshCcw,
  CheckCircle2,
  Radar,
  ShieldCheck,
  Clock3,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { chatCopilot, chatCopilotStream, CopilotRequestError, getProactiveThoughts, getDailyBriefing, loadPeppyConversation, savePeppyConversation } from '../services/gemini';
import { executeAgentAction } from '../services/agentActions';
import { cn } from './Common';

function describeCopilotError(err: unknown): string {
  if (err instanceof CopilotRequestError) {
    if (err.code === 'AI_NOT_CONFIGURED' || err.status === 503) {
      return 'La IA no está configurada en el backend. Añade GEMINI_API_KEY en Vercel y vuelve a desplegar.';
    }
    if (err.code === 'AI_PROVIDER_QUOTA') {
      return 'El proveedor de IA (Gemini) alcanzó su cuota. Puede ser temporal: reinténtalo en un momento. Si persiste, la clave de API necesita más cuota o un plan superior.';
    }
    if (err.code === 'AI_RATE_LIMIT' || err.status === 429) {
      return 'Has alcanzado el límite de consultas a Peppy. Espera unos segundos e inténtalo de nuevo.';
    }
    if (err.code === 'FIREBASE_ADMIN_NOT_CONFIGURED') {
      return 'Firebase Admin no está configurado en el runtime. Revisa FIREBASE_SERVICE_ACCOUNT.';
    }
    if (err.code === 'MEMBERSHIP_NOT_FOUND' || err.code === 'MEMBERSHIP_ROLE_FORBIDDEN' || err.status === 403) {
      return 'No tienes permisos para consultar a Peppy con esta cuenta.';
    }
    if (err.status === 401) {
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    }
    return `No pude conectarme a Peppy: ${err.message}`;
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  return msg
    ? `No pude conectarme a Peppy. Detalle: ${msg}`
    : 'No pude conectarme a Peppy. Inténtalo de nuevo.';
}
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useLocale } from '../hooks/useLocale';
import { format } from 'date-fns';
import { fetchCompanyOverview } from '../services/companyApi';
import { PEPPY } from '../lib/peppy';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  streaming?: boolean;
  timestamp: Date;
  isBriefing?: boolean;
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

function getInsightTone(priority?: string) {
  if (priority === 'high') {
    return {
      chip: 'Vigilancia crítica',
      accent: 'border-red-400/16 bg-red-500/8 text-red-200',
      iconWrap: 'border-red-400/16 bg-red-500/10 text-red-300',
    };
  }
  if (priority === 'medium') {
    return {
      chip: 'Vigilancia activa',
      accent: 'border-amber-400/16 bg-amber-500/8 text-amber-200',
      iconWrap: 'border-amber-400/16 bg-amber-500/10 text-amber-300',
    };
  }
  return {
    chip: 'Señal',
    accent: 'border-blue-400/16 bg-blue-500/8 text-blue-200',
    iconWrap: 'border-blue-400/16 bg-blue-500/10 text-blue-300',
  };
}

export function Copilot() {
  const { company, role } = useAuth();
  const { language, formatCurrency } = useLocale();
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
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [lastBriefingDate, setLastBriefingDate] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    const stored = localStorage.getItem(`peppy_briefing_date_${company.id}`);
    if (stored) setLastBriefingDate(stored);
  }, [company?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) setUnreadInsights(0);
          return !prev;
        });
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsOpen(true);
      setUnreadInsights(0);
      setActiveTab('chat');
    };
    window.addEventListener('open-copilot', handler);
    return () => window.removeEventListener('open-copilot', handler);
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const [conversationLoaded, setConversationLoaded] = useState(false);

  useEffect(() => {
    if (!company || conversationLoaded) return;
    setConversationLoaded(true);
    loadPeppyConversation(company.id).then((loaded) => {
      if (loaded.length > 0) {
        setMessages(loaded);
      } else {
        // Fallback: try localStorage for users with existing history
        try {
          const stored = localStorage.getItem(`copilot_messages_${company.id}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp), streaming: false })));
          }
        } catch (_) {
          // ignore malformed local data
        }
      }
    });
  }, [company?.id, conversationLoaded]);

  useEffect(() => {
    if (!company || messages.length === 0) return;
    const timer = setTimeout(() => {
      const toSave = messages.filter((m) => !m.streaming).slice(-60);
      // Primary: Firestore
      savePeppyConversation(company.id, toSave);
      // Secondary: localStorage backup
      try {
        localStorage.setItem(`copilot_messages_${company.id}`, JSON.stringify(
          toSave.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }))
        ));
      } catch (_) {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [messages, company?.id]);


  const triggerDailyBriefing = useCallback(async () => {
    if (!company || !['owner', 'admin'].includes(role || '')) return;
    try {
      const data = await getDailyBriefing(company.id, language);
      if (!data?.briefing) return;
      const briefingMsg: Message = {
        id: `briefing-${Date.now()}`,
        role: 'model',
        text: data.briefing,
        timestamp: new Date(),
        isBriefing: true,
      };
      setMessages((prev) => [briefingMsg, ...prev]);
      const today = new Date().toDateString();
      setLastBriefingDate(today);
      if (company?.id) localStorage.setItem(`peppy_briefing_date_${company.id}`, today);
      setUnreadInsights((prev) => prev + 1);
      if (!isOpen) showToast(`${PEPPY.name}: Tu briefing del día está listo`);
    } catch (e) {
      console.warn('Daily briefing failed:', e);
    }
  }, [company, role, language, isOpen, showToast]);

  useEffect(() => {
    if (!company) return;

    const runMonitoring = async () => {
      try {
        const overview = await fetchCompanyOverview(company.id);

        const today = new Date().toDateString();
        if (lastBriefingDate !== today && ['owner', 'admin'].includes(role || '')) {
          triggerDailyBriefing();
        }

        setMetrics({
          revenue: Number(overview.recentRevenue30d ?? overview.recentRevenue ?? 0),
          ordersThisWeek: overview.salesVelocity?.currentPeriodOrders || 0,
          lowStockCount: overview.lowStockCount || 0,
          customers: overview.customersCount || 0,
        });
        setLastScanAt(new Date());

        try {
          const thoughts = await getProactiveThoughts(overview, language);
          if (thoughts && thoughts.length > 0) {
            const insight = thoughts[0];
            const newInsight: Insight = {
              id: `insight-${Date.now()}`,
              text: insight.text,
              priority: insight.priority,
              timestamp: new Date(),
            };
            setInsights((prev) => {
              const alreadyExists = prev.some((i) => i.text === newInsight.text);
              if (alreadyExists) return prev;
              return [newInsight, ...prev].slice(0, 20);
            });
            setUnreadInsights((prev) => prev + 1);
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
  }, [company?.id, isOpen, showToast, language, lastBriefingDate, role, triggerDailyBriefing]);

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
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const overview = await fetchCompanyOverview(company.id);
      const context = {
        ...overview,
        userRole: role || 'staff',
        operatorHistory: operatorHistory.slice(0, 3),
      };

      const history = messages
        .filter((m) => !m.streaming)
        .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

      const botMsgId = `m-${Date.now()}`;
      setMessages((prev) => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '',
        streaming: true,
        timestamp: new Date(),
      }]);
      setIsTyping(false);

      await chatCopilotStream(
        textToSend,
        history,
        context,
        language,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => m.id === botMsgId ? { ...m, text: m.text + chunk } : m)
          );
        },
        (cmd) => {
          let command: Message['command'] | undefined;
          if (cmd) {
            const isReviewOnly = ['DRAFT_REPORT', 'REVIEW_ONLY', 'DRAFT_ORDER', 'DRAFT_MESSAGE'].includes(cmd.type) || cmd.params.length > 100;
            command = {
              type: cmd.type === 'NAVIGATE' && cmd.params.length > 50 ? 'REVIEW_ONLY' : cmd.type,
              params: cmd.params,
              summary: '',
              isReviewOnly,
            };
          }
          setMessages((prev) =>
            prev.map((m) => m.id === botMsgId
              ? { ...m, streaming: false, command, commandStatus: command ? 'pending' : undefined }
              : m)
          );
          setOperatorHistory((prev) => [{
            type: cmd ? 'COMMAND' : 'QUERY',
            action: textToSend,
            timestamp: new Date(),
          }, ...prev].slice(0, 10));
        },
        (err) => {
          console.error('Stream error:', err);
          // Fallback to non-streaming on stream failure
          chatCopilot(textToSend, history, context, language).then((text) => {
            setMessages((prev) =>
              prev.map((m) => m.id === botMsgId ? { ...m, text, streaming: false } : m)
            );
          }).catch((fallbackErr) => {
            const errToShow = fallbackErr instanceof CopilotRequestError ? fallbackErr : err;
            setMessages((prev) =>
              prev.map((m) => m.id === botMsgId
                ? { ...m, text: describeCopilotError(errToShow), streaming: false }
                : m)
            );
          });
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      setIsTyping(false);
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model',
        text: describeCopilotError(error),
        timestamp: new Date(),
      }]);
    }
  };

  const handleExecuteAction = async (msgId: string, command: Message['command']) => {
    if (!command || !company) return;
    setActionProcessing(msgId);

    try {
      await new Promise((r) => setTimeout(r, 700));

      if (command.isReviewOnly || ['DRAFT_REPORT', 'REVIEW_ONLY', 'DRAFT_ORDER'].includes(command.type)) {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, commandStatus: 'executed' } : m)));
        return;
      }

      const AGENT_ACTION_TYPES = ['CREATE_REMINDER', 'DRAFT_MESSAGE', 'FLAG_CUSTOMER', 'STOCK_ALERT'];
      if (AGENT_ACTION_TYPES.includes(command.type)) {
        await executeAgentAction(company.id, command.type, command.params);
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, commandStatus: 'executed' } : m)));
        showToast(`${PEPPY.name}: ${command.type === 'CREATE_REMINDER' ? 'Recordatorio creado' : command.type === 'DRAFT_MESSAGE' ? 'Mensaje guardado como borrador' : command.type === 'FLAG_CUSTOMER' ? 'Cliente actualizado' : 'Alerta de stock configurada'}`);
        return;
      }

      if (command.type === 'NAVIGATE') {
        const targetPath = command.params.trim().toLowerCase().split('?')[0];
        const validRoutes = ['/dashboard', '/customers', '/products', '/inventory', '/orders', '/pos', '/insights', '/team', '/settings', '/billing', '/super-admin'];
        const isValid = validRoutes.some((r) => targetPath === r || targetPath.startsWith(`${r}/`));
        if (!isValid) throw new Error(`Restricted target: ${targetPath}`);
        navigate(command.params.trim());
        setIsOpen(false);
      }

      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, commandStatus: 'executed' } : m)));
    } catch (err: any) {
      console.error('Action execution failed:', err);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, commandStatus: 'dismissed' } : m)));
    } finally {
      setActionProcessing(null);
    }
  };

  const openPanel = () => {
    setIsOpen(true);
    setUnreadInsights(0);
  };

  const quickPrompts = [
    { label: 'Informe ejecutivo', prompt: 'Dame un informe operativo ejecutivo y conciso para hoy.', icon: Activity },
    { label: 'Pulso de ingresos', prompt: 'Resume el rendimiento de ingresos y las señales de tendencia.', icon: TrendingUp },
    { label: 'Vigilancia de stock', prompt: 'Muéstrame la exposición por bajo stock y las prioridades de reposición.', icon: Package },
    { label: 'Movimiento de clientes', prompt: '¿Qué clientes necesitan atención ahora mismo?', icon: Users },
  ];

  const intelActions = [
    { label: 'Generar informe semanal', prompt: 'Redacta un informe operativo semanal con ingresos, riesgos y siguientes acciones.', icon: TrendingUp },
    { label: 'Revisar presión de inventario', prompt: 'Inspecciona productos con bajo stock y crea una lista de reposición priorizada.', icon: Package },
    { label: 'Detectar oportunidades de retención', prompt: 'Revisa la actividad de clientes y detecta oportunidades de retención.', icon: Users },
  ];

  const activeCommandCount = useMemo(
    () => messages.filter((m) => m.command && m.commandStatus === 'pending').length,
    [messages]
  );

  return (
    <>
      <AnimatePresence>
        {toast && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className={cn(
              'peppy-toast-pos fixed z-[60] max-w-[340px] rounded-[24px] border border-blue-400/14 bg-[rgba(8,12,18,0.94)] p-4 shadow-[0_18px_56px_rgba(0,0,0,0.44)] backdrop-blur-2xl cursor-pointer',
              isPOSRoute ? 'left-6 right-6 sm:right-auto' : 'right-6'
            )}
            onClick={openPanel}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-400/14 bg-blue-500/10">
                <BrainCircuit className="h-4.5 w-4.5 text-blue-300" />
              </div>
              <div>
                <p className="section-kicker mb-2">Peppy · Vigilancia</p>
                <p className="text-sm leading-relaxed text-neutral-200">{toast}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
      <div className={cn('peppy-btn-pos fixed z-[60]', isPOSRoute ? 'left-6' : 'right-6')}>
        <motion.button
          onClick={openPanel}
          type="button"
          aria-label="Abrir Copilot"
          whileHover={{ scale: 1.035 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-[20px] border transition-all duration-300 lg:h-16 lg:w-16 lg:rounded-[22px]',
            isOpen
              ? 'border-white/12 bg-[rgba(14,18,24,0.96)] shadow-[0_18px_48px_rgba(0,0,0,0.42)]'
              : 'border-blue-400/18 bg-[linear-gradient(180deg,rgba(89,133,255,0.96),rgba(43,88,211,0.96))] shadow-[0_22px_56px_rgba(43,88,211,0.36)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_45%)] before:opacity-90'
          )}
        >
          {(
            <>
              <BrainCircuit className="relative h-6 w-6 text-white" />
              <span className="absolute bottom-1.5 rounded-full border border-white/14 bg-black/20 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-blue-100" title="Peppy AI">
                P
              </span>
              <motion.div
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="absolute inset-[8px] rounded-[18px] border border-white/12"
              />
              <motion.div
                animate={{ opacity: [0.2, 0.6, 0.2], scale: [0.96, 1.02, 0.96] }}
                transition={{ duration: 3.2, repeat: Infinity }}
                className="absolute inset-[5px] rounded-[20px] border border-blue-200/20"
              />
              {unreadInsights > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-[22px] items-center justify-center rounded-full border-2 border-[#05070b] bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-[#03110a]">
                  {unreadInsights > 9 ? '9+' : unreadInsights}
                </span>
              )}
            </>
          )}
        </motion.button>
      </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[68] bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 z-[70] flex h-[100dvh] w-full flex-col border-l border-white/8 bg-[rgba(5,8,12,0.98)] shadow-[0_0_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:w-[470px]"
          >
            <div className="border-b border-white/6 px-5 pb-4 pt-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/14 bg-blue-500/12">
                    <BrainCircuit className="h-5 w-5 text-blue-200" />
                    <div className="absolute inset-[7px] rounded-[14px] border border-white/10" />
                  </div>
                  <div>
                    <p className="section-kicker mb-1">Consola operativa</p>
                    <p className="font-display text-xl font-bold tracking-tight text-white">{company?.name || 'Remix OS'} · {PEPPY.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="telemetry-chip !px-2.5 !py-1">
                        <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
                        {PEPPY.name} · Activo
                      </span>
                      <span className="telemetry-chip !px-2.5 !py-1">
                        <ShieldCheck className="h-3 w-3 text-blue-300" />
                        Modo operador
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar Copilot"
                  onClick={() => setIsOpen(false)}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-2.5 text-neutral-500 transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {metrics && (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Ingresos',
                      value: formatCurrency(metrics.revenue),
                      icon: TrendingUp,
                      accent: 'text-emerald-300',
                    },
                    {
                      label: 'Pedidos / 7d',
                      value: String(metrics.ordersThisWeek),
                      icon: Activity,
                      accent: 'text-blue-300',
                    },
                    {
                      label: 'Bajo stock',
                      value: String(metrics.lowStockCount),
                      icon: Package,
                      accent: metrics.lowStockCount > 0 ? 'text-red-300' : 'text-neutral-400',
                    },
                  ].map((item) => (
                    <div key={item.label} className="data-tile !rounded-[22px] !p-3">
                      <item.icon className={cn('mb-2 h-4 w-4', item.accent)} />
                      <p className="truncate font-mono text-sm font-bold text-white">{item.value}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="telemetry-chip !px-2.5 !py-1">
                  <Radar className="h-3 w-3 text-blue-300" />
                  {lastScanAt ? `Ultimo escaneo ${format(lastScanAt, 'HH:mm')}` : 'Monitoreando'}
                </span>
                <span className="telemetry-chip !px-2.5 !py-1">
                  <Clock3 className="h-3 w-3 text-neutral-300" />
                  Refresco / 2m
                </span>
                {activeCommandCount > 0 && (
                  <span className="telemetry-chip !px-2.5 !py-1">
                    <Zap className="h-3 w-3 text-amber-300" />
                    {activeCommandCount} accion lista
                  </span>
                )}
              </div>

              <div className="flex rounded-2xl border border-white/8 bg-white/[0.03] p-1">
                {[
                  { id: 'chat', label: PEPPY.name, icon: MessageSquare },
                  { id: 'intel', label: `Vigilancia IA${unreadInsights > 0 ? ` · ${unreadInsights}` : ''}`, icon: Zap },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as 'chat' | 'intel');
                      if (tab.id === 'intel') setUnreadInsights(0);
                    }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-[14px] py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition-all',
                      activeTab === tab.id ? 'bg-white/[0.08] text-white' : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {activeTab === 'chat' && (
                <>
                  <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
                    {messages.length === 0 && (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <div className="surface-elevated max-w-sm p-6">
                          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] border border-blue-400/14 bg-blue-500/10">
                            <Sparkles className="h-7 w-7 text-blue-300" />
                          </div>
                          <p className="section-kicker mb-2">{PEPPY.name}</p>
                          <h4 className="mb-3 text-lg font-semibold text-white">¡Hola! Soy {PEPPY.name}.</h4>
                          <p className="mb-6 text-sm leading-relaxed text-neutral-400">
                            {PEPPY.tagline} Puedo resumir flujo de ingresos, presión de producto, movimiento de clientes, crear recordatorios y acciones recomendadas a partir de datos reales del espacio de trabajo.
                          </p>

                          <div className="space-y-2 text-left">
                            {quickPrompts.map((prompt) => (
                              <button
                                key={prompt.label}
                                onClick={() => handleSendMessage(prompt.prompt)}
                                className="surface-elevated flex w-full items-center gap-3 p-3 transition-all hover:border-blue-400/16 hover:bg-white/[0.035]"
                              >
                                <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                                  <prompt.icon className="h-4 w-4 text-neutral-300" />
                                </div>
                                <span className="flex-1 text-sm font-medium text-neutral-300">{prompt.label}</span>
                                <ChevronRight className="h-4 w-4 text-neutral-600" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {messages.map((m) => (
                      <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[90%] rounded-[24px] text-[13px] leading-relaxed shadow-[0_12px_34px_rgba(0,0,0,0.24)]',
                          m.role === 'user'
                            ? 'border border-blue-300/18 bg-[linear-gradient(180deg,rgba(91,136,255,0.96),rgba(49,92,214,0.96))] px-4 py-3 text-white'
                            : 'border border-white/8 bg-white/[0.03] px-4 py-3 text-neutral-300'
                        )}>
                          {m.role === 'user' ? (
                            <div>
                              <p>{m.text}</p>
                              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
                                Entrada operativa · {format(m.timestamp, 'HH:mm')}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <div className="mb-3 flex items-center gap-2">
                                {m.isBriefing ? (
                                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                                    {PEPPY.name} · Briefing Diario
                                  </span>
                                ) : (
                                  <span className="operator-badge !px-2.5 !py-1">{PEPPY.name}</span>
                                )}
                                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">{format(m.timestamp, 'HH:mm')}</span>
                              </div>

                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2.5 last:mb-0 text-neutral-300 leading-relaxed">{children}</p>,
                                  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                                  ul: ({ children }) => <ul className="mb-3 space-y-1.5 last:mb-0">{children}</ul>,
                                  li: ({ children }) => (
                                    <li className="flex items-start gap-2 text-[13px] text-neutral-400">
                                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/60" />
                                      <span>{children}</span>
                                    </li>
                                  ),
                                }}
                              >
                                {m.text}
                              </ReactMarkdown>

                              {m.streaming && (
                                <span className="inline-block h-3.5 w-2 rounded-sm bg-blue-300 align-text-bottom animate-pulse" />
                              )}

                              {!m.streaming && m.text.includes('ACTION_REQUIRED:') && (
                                <div className="mt-4 border-t border-white/6 pt-4">
                                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Ruta sugerida</p>
                                  <div className="flex flex-wrap gap-2">
                                    {m.text.split('\n').map((line, li) => {
                                      if (!line.includes('ACTION_REQUIRED:')) return null;
                                      const action = line.split('ACTION_REQUIRED:')[1].trim();
                                      const mapping: Record<string, { label: string; path: string }> = {
                                        VIEW_INVENTORY: { label: 'Inventario', path: '/inventory' },
                                        VIEW_ORDERS: { label: 'Pedidos', path: '/orders' },
                                        VIEW_CUSTOMERS: { label: 'Clientes', path: '/customers' },
                                        VIEW_INSIGHTS: { label: 'Análisis IA', path: '/insights' },
                                      };
                                      const cfg = mapping[action];
                                      if (!cfg) return null;
                                      return (
                                        <button
                                          key={li}
                                          onClick={() => {
                                            setIsOpen(false);
                                            navigate(cfg.path);
                                          }}
                                          className="rounded-xl border border-blue-400/16 bg-blue-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200 transition-colors hover:bg-blue-500/20"
                                        >
                                          {cfg.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {!m.streaming && m.command && m.commandStatus === 'pending' && (
                                <div className="mt-4 border-t border-white/6 pt-4">
                                  <div className="surface-elevated p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                      <Zap className="h-4 w-4 text-blue-300" />
                                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">
                                        {m.command.isReviewOnly ? 'Revisión lista' : 'Acción lista'} · {m.command.type.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleExecuteAction(m.id, m.command)}
                                        disabled={actionProcessing === m.id}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-300/18 bg-[linear-gradient(180deg,rgba(91,136,255,0.96),rgba(49,92,214,0.96))] py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
                                      >
                                        {actionProcessing === m.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                        {m.command.isReviewOnly ? 'Confirmar' : 'Ejecutar'}
                                      </button>
                                      <button
                                        onClick={() => setMessages((prev) => prev.map((msg) => msg.id === m.id ? { ...msg, commandStatus: 'dismissed' } : msg))}
                                        className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400 transition-colors hover:text-white"
                                      >
                                        Omitir
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {!m.streaming && m.command && m.commandStatus === 'executed' && (
                                <div className="mt-3 flex items-center gap-2 text-emerald-300">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Acción confirmada</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {isTyping && !messages.some((m) => m.streaming) && (
                      <div className="flex justify-start">
                        <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3">
                          <div className="flex gap-1.5">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-300/60" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-300/60 [animation-delay:0.15s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-300/60 [animation-delay:0.3s]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/6 bg-[rgba(5,8,12,0.98)] p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="telemetry-chip !px-2.5 !py-1">Rol · {role || 'staff'}</span>
                      <span className="telemetry-chip !px-2.5 !py-1">Modo · chat</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSendMessage()}
                        placeholder="Pide un informe, una vigilancia, un resumen o la siguiente acción..."
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-400/25 focus:border-blue-400/30"
                      />
                      <button
                        type="button"
                        aria-label="Enviar mensaje"
                        onClick={() => handleSendMessage()}
                        disabled={!inputText.trim() || isTyping}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/18 bg-[linear-gradient(180deg,rgba(91,136,255,0.96),rgba(49,92,214,0.96))] text-white shadow-[0_16px_34px_rgba(43,88,211,0.28)] transition-all hover:brightness-105 disabled:opacity-30"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                    {messages.length > 0 && (
                      <button
                        onClick={() => {
                          setMessages([]);
                          if (company) {
                            localStorage.removeItem(`copilot_messages_${company.id}`);
                            savePeppyConversation(company.id, []);
                          }
                        }}
                        className="mt-3 w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 transition-colors hover:text-neutral-400"
                      >
                        Limpiar sesión de {PEPPY.name}
                      </button>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'intel' && (
                <div ref={scrollRef} className="custom-scrollbar flex-1 overflow-y-auto p-5">
                  {insights.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <div className="surface-elevated max-w-sm p-6">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03]">
                          <Zap className="h-5 w-5 text-neutral-500" />
                        </div>
                        <p className="section-kicker mb-2">Peppy · Vigilancia</p>
                        <p className="text-base font-semibold text-white">Aún no hay señales de Peppy</p>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                          Copilot escanea el grafo operativo cada dos minutos y publica aquí las señales relevantes.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="section-kicker">Cola de señales</p>
                        <span className="telemetry-chip !px-2.5 !py-1">{insights.length} observaciones</span>
                      </div>

                      {insights.map((ins) => {
                        const tone = getInsightTone(ins.priority);
                        return (
                          <motion.div
                            key={ins.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="surface-elevated p-4"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <span className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]', tone.accent)}>
                                {tone.chip}
                              </span>
                              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
                                {format(ins.timestamp, 'HH:mm')} · {PEPPY.name}
                              </span>
                            </div>
                            <div className="flex gap-3">
                              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border', tone.iconWrap)}>
                                <BrainCircuit className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm leading-relaxed text-neutral-200">{ins.text}</p>
                                <button
                                  onClick={() => {
                                    setActiveTab('chat');
                                    handleSendMessage(`Cuéntame más sobre esta señal operativa: "${ins.text.slice(0, 100)}"`);
                                  }}
                                  className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 transition-colors hover:text-blue-100"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  Abrir en chat
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}

                      <div className="mt-6 border-t border-white/6 pt-5">
                        <p className="mb-3 section-kicker">Playbooks del operador</p>
                        <div className="space-y-2">
                          {intelActions.map((action) => (
                            <button
                              key={action.label}
                              onClick={() => {
                                setActiveTab('chat');
                                handleSendMessage(action.prompt);
                              }}
                              className="surface-elevated flex w-full items-center gap-3 p-3 text-left transition-all hover:border-blue-400/16 hover:bg-white/[0.035]"
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                                <action.icon className="h-4 w-4 text-neutral-300" />
                              </div>
                              <span className="flex-1 text-sm font-medium text-neutral-300">{action.label}</span>
                              <ChevronRight className="h-4 w-4 text-neutral-600" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
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

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
  PanelRightOpen,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { chatCopilot, checkAiHealth, CopilotRequestError, getProactiveThoughts } from '../services/gemini';
import { cn, OSGlyph } from './Common';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useLocale } from '../hooks/useLocale';
import { format } from 'date-fns';
import { fetchCompanyOverview } from '../services/companyApi';

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

type CopilotPhase = 'idle' | 'connecting' | 'analyzing' | 'error';

function getInsightTone(priority?: string) {
  if (priority === 'high') {
    return {
      chip: 'Vigilancia critica',
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

function buildCopilotDiagnostic(message: string, aiConfigured: boolean) {
  if (!aiConfigured) {
    return [
      'La IA no está configurada. Añade GEMINI_API_KEY en Vercel.',
      '',
      'Próximos pasos:',
      '- Añade `GEMINI_API_KEY` en Vercel.',
      '- Verifica que la función `/api/index` esté desplegada.',
      '- Redeploy de la app para que el backend tome la variable.',
    ].join('\n');
  }

  return [
    'No se pudo completar la consulta del Copilot.',
    '',
    `Diagnóstico: ${message}`,
    '',
    'Próximos pasos:',
    '- Verifica que `/api/company/overview` y `/api/ai/chat` respondan.',
    '- Confirma que Firebase Admin esté configurado en el backend.',
    '- Reintenta cuando el backend vuelva a estar disponible.',
  ].join('\n');
}

function hasOperationalData(overview: any) {
  return (
    Number(overview?.productsCount || 0) > 0 ||
    Number(overview?.customersCount || 0) > 0 ||
    Number(overview?.ordersCount || overview?.salesVelocity?.currentPeriodOrders || 0) > 0 ||
    Number(overview?.inventoryValue || 0) > 0
  );
}

const EMPTY_OPERATIONAL_DATA_MESSAGE = 'Todavía no hay suficientes datos operativos. Añade productos, clientes o pedidos para generar análisis más avanzados.';

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
  const [phase, setPhase] = useState<CopilotPhase>('idle');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [messages, activeTab, insights]);

  useEffect(() => {
    if (!company?.id) {
      setAiConfigured(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const health = await checkAiHealth();
        if (cancelled) return;
        setAiConfigured(Boolean(health?.geminiConfigured));
      } catch (error) {
        if (cancelled || !(error instanceof CopilotRequestError)) return;
        if (error.code === 'AI_NOT_CONFIGURED' || error.status === 503) {
          setAiConfigured(false);
          return;
        }
        if (error.status === 404) {
          setCopilotError('El endpoint de IA no esta desplegado o no existe en este entorno.');
          return;
        }
        if (error.status === 401) {
          setCopilotError('Tu sesion no esta autenticada para usar Copilot.');
          return;
        }
        if (error.status === 403) {
          setCopilotError('No tienes permisos para usar la IA con la empresa activa.');
          return;
        }
        if (error.status === 500) {
          setCopilotError('Error interno del backend al consultar el estado de la IA.');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  useEffect(() => {
    return () => {
      if (streamingRef.current) clearInterval(streamingRef.current);
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const resolveCopilotError = useCallback((error: unknown) => {
    if (error instanceof CopilotRequestError) {
      if (error.code === 'AI_NOT_CONFIGURED' || error.status === 503) {
        setAiConfigured(false);
        return 'IA no configurada en el runtime del backend. Revisa GEMINI_API_KEY en Vercel y vuelve a desplegar.';
      }
      if (error.status === 429 || error.code === 'AI_RATE_LIMIT') {
        return 'Demasiadas solicitudes a la IA en poco tiempo. Espera unos segundos y vuelve a intentarlo.';
      }
      if (error.status === 401) return 'Tu sesión no está autenticada para usar Copilot.';
      if (error.status === 403) return 'No tienes permisos para usar la IA con la empresa activa.';
      if (error.status === 400) return 'La solicitud a la IA no es valida. Revisa el mensaje e intenta de nuevo.';
      if (error.status === 404) return 'El endpoint de IA no está desplegado o no existe en este entorno.';
      if (error.status === 500) return 'Error interno del backend al procesar la solicitud de IA.';
      return error.message || 'La IA no pudo procesar la solicitud.';
    }

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return 'No se pudo conectar con el backend de Copilot. Verifica que las rutas /api estén activas.';
      }
      return error.message || 'La IA no pudo procesar la solicitud.';
    }

    return 'La IA no pudo procesar la solicitud.';
  }, []);

  const normalizedCopilotError = useCallback((error: unknown) => {
    if (error instanceof CopilotRequestError) {
      if (error.code === 'AI_NOT_CONFIGURED' || error.status === 503) {
        setAiConfigured(false);
        return 'La IA no está configurada. Añade GEMINI_API_KEY en Vercel.';
      }
      if (error.status === 429 || error.code === 'AI_RATE_LIMIT') {
        return 'Demasiadas solicitudes a la IA en poco tiempo. Espera unos segundos y vuelve a intentarlo.';
      }
      if (error.status === 401) return 'Tu sesión no está autenticada para usar Copilot.';
      if (error.status === 403) return 'No tienes permisos para usar la IA con la empresa activa.';
      if (error.status === 400) return 'La solicitud a la IA no es válida. Revisa el mensaje e inténtalo de nuevo.';
      if (error.status === 404) return 'El endpoint de IA no está desplegado o no existe en este entorno.';
      if (error.status === 500) return 'Error interno del backend al procesar la solicitud de IA.';
      if (error.status >= 500) return 'No se pudo contactar con la IA.';
      return error.message || 'No se pudo contactar con la IA.';
    }

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return 'No se pudo contactar con la IA.';
      }
      return error.message || 'No se pudo contactar con la IA.';
    }

    return 'No se pudo contactar con la IA.';
  }, []);

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
    } catch {
      // ignore malformed local data
    }
  }, [company?.id]);

  useEffect(() => {
    if (!company || messages.length === 0) return;
    const timer = setTimeout(() => {
      const toSave = messages
        .filter((m) => !m.streaming)
        .slice(-60)
        .map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
      localStorage.setItem(`copilot_messages_${company.id}`, JSON.stringify(toSave));
    }, 600);
    return () => clearTimeout(timer);
  }, [messages, company?.id]);

  const simulateStreaming = useCallback((msgId: string, fullText: string) => {
    const words = fullText.split(/\s+/).filter(Boolean);
    let i = 0;

    if (streamingRef.current) clearInterval(streamingRef.current);

    if (words.length === 0) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text: fullText, streaming: false } : m)));
      return;
    }

    streamingRef.current = setInterval(() => {
      i += 1;
      const partial = words.slice(0, i).join(' ');
      const done = i >= words.length;
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text: partial, streaming: !done } : m)));
      if (done && streamingRef.current) {
        clearInterval(streamingRef.current);
      }
    }, 20);
  }, []);

  useEffect(() => {
    if (!company) return;

    const runMonitoring = async () => {
      try {
        console.info('[Copilot] Requesting business overview for monitoring.', {
          companyId: company.id,
        });
        const overview = await fetchCompanyOverview(company.id);
        console.info('[Copilot] Business overview loaded for monitoring.', {
          companyId: company.id,
          productsCount: overview.productsCount || 0,
          customersCount: overview.customersCount || 0,
          ordersCount: overview.ordersCount || 0,
          inventoryValue: overview.inventoryValue || 0,
        });
        setMetrics({
          revenue: Number(overview.recentRevenue30d ?? overview.recentRevenue ?? 0),
          ordersThisWeek: overview.salesVelocity?.currentPeriodOrders || 0,
          lowStockCount: overview.lowStockCount || 0,
          customers: overview.customersCount || 0,
        });
        setAiConfigured(true);
        setLastScanAt(new Date());
        setCopilotError(null);

        if (!hasOperationalData(overview)) {
          console.info('[Copilot] Empty operational context detected during monitoring.', {
            companyId: company.id,
          });
          return;
        }

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
        } catch (error) {
          console.warn('Proactive thoughts failed:', error);
          const message = normalizedCopilotError(error);
          setCopilotError(message);
        }
      } catch (error) {
        console.error('[Copilot] Monitoring error:', error);
        const message = normalizedCopilotError(error);
        setCopilotError(message);
      }
    };

    runMonitoring();
    const interval = setInterval(runMonitoring, 60000 * 2);
    return () => clearInterval(interval);
  }, [company?.id, isOpen, showToast, language, normalizedCopilotError]);

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || inputText).trim();
    if (!textToSend || !company) return;

    if (!overrideText) setInputText('');
    setCopilotError(null);
    setAiConfigured(true);
    setPhase('connecting');
    setPhaseLabel('Conectando con IA...');

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      console.info('[Copilot] Requesting business overview for chat.', {
        companyId: company.id,
        role,
      });
      const overview = await fetchCompanyOverview(company.id);
      const operationalDataAvailable = hasOperationalData(overview);
      console.info('[Copilot] Business overview loaded for chat.', {
        companyId: company.id,
        productsCount: overview.productsCount || 0,
        customersCount: overview.customersCount || 0,
        ordersCount: overview.ordersCount || 0,
        inventoryValue: overview.inventoryValue || 0,
        operationalDataAvailable,
      });
      setPhaseLabel('Analizando datos del negocio...');
      setPhase('analyzing');
      setPhaseLabel('Analizando datos del negocio...');
      setPhaseLabel('Analizando operación...');

      setPhaseLabel('Analizando datos del negocio...');

      const context = {
        ...overview,
        userRole: role || 'staff',
        operatorHistory: operatorHistory.slice(0, 3),
      };

      const history = messages
        .filter((m) => !m.streaming)
        .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

      const aiResponse = await chatCopilot(textToSend, history, context, language);
      if (!aiResponse || !aiResponse.trim()) {
        throw new Error('La IA no devolvió contenido útil.');
      }

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
      setMessages((prev) => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '',
        streaming: true,
        timestamp: new Date(),
        command,
        commandStatus: command ? 'pending' : undefined,
      }]);

      setIsTyping(false);
      setPhase('idle');
      setPhaseLabel('');
      if (!operationalDataAvailable) {
        setCopilotError(EMPTY_OPERATIONAL_DATA_MESSAGE);
      }
      simulateStreaming(botMsgId, cleanText);

      setOperatorHistory((prev) => [{
        type: commandMatch ? 'COMMAND' : 'QUERY',
        action: textToSend,
        timestamp: new Date(),
      }, ...prev].slice(0, 10));
    } catch (error) {
      console.error('[Copilot] Chat error:', error);
      const message = normalizedCopilotError(error);
      const diagnostic = buildCopilotDiagnostic(
        message,
        message.includes('GEMINI_API_KEY') || message.includes('no está configurada') || !aiConfigured
      );
      setIsTyping(false);
      setPhase('error');
      setPhaseLabel(message);
      setCopilotError(message);
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model',
        text: diagnostic,
        timestamp: new Date(),
      }]);
    }
  };

  const handleExecuteAction = async (msgId: string, command: Message['command']) => {
    if (!command) return;
    setActionProcessing(msgId);

    try {
      await new Promise((r) => setTimeout(r, 700));

      if (command.isReviewOnly || ['DRAFT_REPORT', 'REVIEW_ONLY', 'DRAFT_ORDER'].includes(command.type)) {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, commandStatus: 'executed' } : m)));
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
    } catch (error) {
      console.error('Action execution failed:', error);
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

  const normalizedQuickPrompts = [
    { label: 'Informe ejecutivo', prompt: 'Dame un informe operativo ejecutivo y conciso para hoy.', icon: Activity },
    { label: 'Pulso de ingresos', prompt: 'Resume el rendimiento de ingresos y las señales de tendencia.', icon: TrendingUp },
    { label: 'Vigilancia de stock', prompt: 'Muéstrame la exposición por bajo stock y las prioridades de reposición.', icon: Package },
    { label: 'Movimiento de clientes', prompt: '¿Qué clientes necesitan atención ahora mismo?', icon: Users },
  ];

  const normalizedIntelActions = [
    { label: 'Generar informe semanal', prompt: 'Redacta un informe operativo semanal con ingresos, riesgos y siguientes acciones.', icon: TrendingUp },
    { label: 'Revisar presión de inventario', prompt: 'Inspecciona productos con bajo stock y crea una lista de reposición priorizada.', icon: Package },
    { label: 'Detectar oportunidades de retención', prompt: 'Revisa la actividad de clientes y detecta oportunidades de retención.', icon: Users },
  ];

  const activeCommandCount = useMemo(
    () => messages.filter((m) => m.command && m.commandStatus === 'pending').length,
    [messages]
  );

  const phaseChip = useMemo(() => {
    if (phase === 'connecting') return { label: 'Conectando con IA...', accent: 'text-blue-200' };
    if (phase === 'analyzing') return { label: 'Analizando operación...', accent: 'text-amber-200' };
    if (!aiConfigured) return { label: 'IA no configurada', accent: 'text-red-200' };
    if (phase === 'error') return { label: 'Error de operación IA', accent: 'text-red-200' };
    return { label: 'Operador en línea', accent: 'text-emerald-200' };
  }, [aiConfigured, phase]);

  const displayPhaseChip = useMemo(() => {
    if (phase === 'connecting') return { label: 'Conectando con IA...', accent: 'text-blue-200' };
    if (phase === 'analyzing') return { label: 'Analizando datos del negocio...', accent: 'text-amber-200' };
    if (!aiConfigured) return { label: 'IA no configurada', accent: 'text-red-200' };
    if (phase === 'error') return { label: 'No se pudo contactar con la IA', accent: 'text-red-200' };
    return { label: 'Operador en línea', accent: 'text-emerald-200' };
  }, [aiConfigured, phase]);

  return (
    <>
      <AnimatePresence>
        {toast && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className={cn(
              'fixed bottom-24 z-[60] max-w-[360px] rounded-[24px] border border-blue-400/14 bg-[rgba(8,12,18,0.94)] p-4 shadow-[0_18px_56px_rgba(0,0,0,0.44)] backdrop-blur-2xl cursor-pointer',
              isPOSRoute ? 'left-6 right-6 sm:right-auto' : 'right-6'
            )}
            onClick={openPanel}
          >
            <div className="flex gap-3">
              <OSGlyph tone="blue" size="sm">
                <BrainCircuit className="h-4 w-4" />
              </OSGlyph>
              <div>
                <p className="section-kicker mb-2">Vigilancia IA</p>
                <p className="text-sm leading-relaxed text-neutral-200">{toast}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('fixed bottom-6 z-[60]', isPOSRoute ? 'left-6 right-6 sm:right-auto' : 'right-6', isOpen && 'pointer-events-none opacity-0')}>
        <motion.button
          onClick={() => {
            if (isOpen) setIsOpen(false);
            else openPanel();
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'operator-launcher group relative flex h-13 items-center gap-2.5 overflow-hidden rounded-[20px] border px-3.5 pr-4 transition-all duration-300',
            isOpen
              ? 'border-white/12 bg-[rgba(14,18,24,0.96)] shadow-[0_18px_48px_rgba(0,0,0,0.42)]'
              : 'border-blue-400/18 bg-[linear-gradient(180deg,rgba(15,22,37,0.96),rgba(7,11,18,0.96))] shadow-[0_22px_56px_rgba(6,10,20,0.38)]'
          )}
        >
          <OSGlyph tone={isOpen ? 'neutral' : 'blue'} size="sm" className="relative">
            {isOpen ? <X className="h-4 w-4 text-white" /> : <PanelRightOpen className="h-4 w-4" />}
          </OSGlyph>

          <div className="min-w-0 text-left">
            <p className="section-kicker mb-1 !text-blue-200/80">Operador IA</p>
            <p className="truncate text-[11px] font-semibold text-white">{displayPhaseChip.label}</p>
          </div>

          {!isOpen && (
            <div className="ml-auto flex items-center gap-2">
              {unreadInsights > 0 && (
                <span className="flex min-w-[22px] items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400 px-2 py-1 text-[10px] font-black text-[#03110a]">
                  {unreadInsights > 9 ? '9+' : unreadInsights}
                </span>
              )}
              <BrainCircuit className="h-3.5 w-3.5 text-blue-300" />
            </div>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[45] bg-black/50 backdrop-blur-sm"
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
            className="fixed right-0 top-0 z-[50] flex h-full w-full flex-col border-l border-white/8 bg-[rgba(5,8,12,0.98)] shadow-[0_0_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:w-[480px]"
          >
            <div className="border-b border-white/6 px-5 pb-4 pt-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <OSGlyph tone="blue" size="md">
                    <BrainCircuit className="h-4.5 w-4.5" />
                  </OSGlyph>
                  <div>
                    <p className="section-kicker mb-1">Consola operativa</p>
                    <p className="font-display text-xl font-bold tracking-tight text-white">{company?.name || 'Remix OS'} Copilot</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="telemetry-chip !px-2.5 !py-1">
                        <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
                        Vigilancia IA
                      </span>
                      <span className="telemetry-chip !px-2.5 !py-1">
                        <ShieldCheck className="h-3 w-3 text-blue-300" />
                        Modo operador
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-2.5 text-neutral-500 transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {metrics && (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Ingresos', value: formatCurrency(metrics.revenue), icon: TrendingUp, accent: 'text-emerald-300' },
                    { label: 'Pedidos / 7d', value: String(metrics.ordersThisWeek), icon: Activity, accent: 'text-blue-300' },
                    { label: 'Bajo stock', value: String(metrics.lowStockCount), icon: Package, accent: metrics.lowStockCount > 0 ? 'text-red-300' : 'text-neutral-400' },
                  ].map((item) => (
                    <div key={item.label} className="data-tile !rounded-[22px] !p-3">
                      <OSGlyph tone={item.accent.includes('red') ? 'red' : item.accent.includes('emerald') ? 'emerald' : 'blue'} size="sm" className="mb-2">
                        <item.icon className={cn('h-3.5 w-3.5', item.accent)} />
                      </OSGlyph>
                      <p className="truncate font-mono text-sm font-bold text-white">{item.value}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="telemetry-chip !px-2.5 !py-1">
                  <Radar className="h-3 w-3 text-blue-300" />
                  {lastScanAt ? `Último escaneo ${format(lastScanAt, 'HH:mm')}` : 'Monitoreando'}
                </span>
                <span className="telemetry-chip !px-2.5 !py-1">
                  <Clock3 className="h-3 w-3 text-neutral-300" />
                  Refresco / 2m
                </span>
                <span className={cn('telemetry-chip !px-2.5 !py-1', displayPhaseChip.accent)}>
                  <Zap className="h-3 w-3" />
                  {displayPhaseChip.label}
                </span>
                {activeCommandCount > 0 && (
                  <span className="telemetry-chip !px-2.5 !py-1">
                    <Zap className="h-3 w-3 text-amber-300" />
                    {activeCommandCount} acción lista
                  </span>
                )}
              </div>

              {!aiConfigured && (
                <div className="rounded-[20px] border border-red-400/16 bg-red-500/8 p-4 text-sm text-red-100">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">IA no configurada</span>
                  </div>
                  <p className="leading-relaxed">La IA no está configurada. Añade <code>GEMINI_API_KEY</code> en Vercel.</p>
                </div>
              )}

              {copilotError && aiConfigured && (
                <div className="rounded-[20px] border border-amber-400/16 bg-amber-500/8 p-4 text-sm text-amber-100">
                  {copilotError}
                </div>
              )}

              <div className="mt-4 flex rounded-2xl border border-white/8 bg-white/[0.03] p-1">
                {[
                  { id: 'chat', label: 'Operador IA', icon: MessageSquare },
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
                          <OSGlyph tone="blue" size="lg" className="mx-auto mb-5">
                            <Sparkles className="h-6 w-6" />
                          </OSGlyph>
                          <p className="section-kicker mb-2">Operador IA</p>
                          <h4 className="mb-3 text-lg font-semibold text-white">Pide un informe operativo real</h4>
                          <p className="mb-6 text-sm leading-relaxed text-neutral-400">
                            Puedo resumir flujo de ingresos, presión de producto, movimiento de clientes y acciones recomendadas a partir de datos reales del espacio de trabajo.
                          </p>

                          <div className="space-y-2 text-left">
                            {normalizedQuickPrompts.map((prompt) => (
                              <button
                                key={prompt.label}
                                onClick={() => handleSendMessage(prompt.prompt)}
                                className="surface-elevated flex w-full items-center gap-3 p-3 transition-all hover:border-blue-400/16 hover:bg-white/[0.035]"
                              >
                              <OSGlyph tone="neutral" size="sm">
                                <prompt.icon className="h-4 w-4 text-neutral-300" />
                              </OSGlyph>
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
                        <div
                          className={cn(
                            'max-w-[90%] rounded-[24px] text-[13px] leading-relaxed shadow-[0_12px_34px_rgba(0,0,0,0.24)]',
                            m.role === 'user'
                              ? 'border border-blue-300/18 bg-[linear-gradient(180deg,rgba(91,136,255,0.96),rgba(49,92,214,0.96))] px-4 py-3 text-white'
                              : 'border border-white/8 bg-white/[0.03] px-4 py-3 text-neutral-300'
                          )}
                        >
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
                                <span className="operator-badge !px-2.5 !py-1">Operador IA</span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">{format(m.timestamp, 'HH:mm')}</span>
                              </div>

                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed text-neutral-300">{children}</p>,
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

                              {m.streaming && <span className="inline-block h-3.5 w-2 animate-pulse rounded-sm bg-blue-300 align-text-bottom" />}

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
                                        VIEW_INSIGHTS: { label: 'Analisis IA', path: '/insights' },
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
                          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{phaseLabel || 'Analizando operación...'}</p>
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isTyping) {
                            void handleSendMessage();
                          }
                        }}
                        placeholder={aiConfigured ? 'Pide un informe, una vigilancia, un resumen o la siguiente acción...' : 'IA no configurada'}
                        disabled={!aiConfigured}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-blue-400/30 focus:outline-none focus:ring-2 focus:ring-blue-400/25 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <button
                        onClick={() => void handleSendMessage()}
                        disabled={!inputText.trim() || isTyping || !aiConfigured}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/18 bg-[linear-gradient(180deg,rgba(91,136,255,0.96),rgba(49,92,214,0.96))] text-white shadow-[0_16px_34px_rgba(43,88,211,0.28)] transition-all hover:brightness-105 disabled:opacity-30"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                    {messages.length > 0 && (
                      <button
                        onClick={() => {
                          setMessages([]);
                          setCopilotError(null);
                          setPhase('idle');
                          setPhaseLabel('');
                          if (company) localStorage.removeItem(`copilot_messages_${company.id}`);
                        }}
                        className="mt-3 w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 transition-colors hover:text-neutral-400"
                      >
                        Limpiar sesión del operador
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
                          <OSGlyph tone="neutral" size="lg" className="mx-auto mb-4">
                            <Zap className="h-5 w-5 text-neutral-500" />
                          </OSGlyph>
                        <p className="section-kicker mb-2">Vigilancia IA</p>
                        <p className="text-base font-semibold text-white">Aún no hay señales del operador</p>
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
                                {format(ins.timestamp, 'HH:mm')} · IA
                              </span>
                            </div>
                            <div className="flex gap-3">
                              <OSGlyph tone={ins.priority === 'high' ? 'red' : ins.priority === 'medium' ? 'amber' : 'blue'} size="sm">
                                <BrainCircuit className="h-4 w-4" />
                              </OSGlyph>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm leading-relaxed text-neutral-200">{ins.text}</p>
                                <button
                                  onClick={() => {
                                    setActiveTab('chat');
                                    void handleSendMessage(`Cuéntame más sobre esta señal operativa: "${ins.text.slice(0, 100)}"`);
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
                          {normalizedIntelActions.map((action) => (
                            <button
                              key={action.label}
                              onClick={() => {
                                setActiveTab('chat');
                                void handleSendMessage(action.prompt);
                              }}
                              className="surface-elevated flex w-full items-center gap-3 p-3 text-left transition-all hover:border-blue-400/16 hover:bg-white/[0.035]"
                            >
                              <OSGlyph tone="neutral" size="sm">
                                <action.icon className="h-4 w-4 text-neutral-300" />
                              </OSGlyph>
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

import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Cpu,
  Layers,
  Package,
  Radar,
  ShieldCheck,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react';
import { Button, OSGlyph, cn } from '../components/Common';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { RemixLogo } from '../components/brand/RemixLogo';

const modules = [
  {
    icon: Users,
    title: 'Clientes y relación',
    desc: 'Centraliza historial, seguimiento y señales de valor en una sola vista operativa.',
    tone: 'text-blue-300',
  },
  {
    icon: Package,
    title: 'Catálogo y stock',
    desc: 'Controla inventario, variantes y alertas de reposición sin salir del núcleo.',
    tone: 'text-emerald-300',
  },
  {
    icon: ShoppingCart,
    title: 'Pedidos y caja',
    desc: 'Opera ventas y flujo comercial con una capa visual consistente y rápida.',
    tone: 'text-amber-300',
  },
  {
    icon: Cpu,
    title: 'Operador IA',
    desc: 'Recibe insights, vigilancia operativa y prioridades accionables sobre datos reales.',
    tone: 'text-cyan-300',
  },
];

const typewriterLines = [
  'Analiza ventas, inventario y clientes en tiempo real.',
  'Detecta riesgos antes de que afecten tus ingresos.',
  'Convierte datos operativos en decisiones accionables.',
  'Prioriza clientes, pedidos y stock desde una sola consola.',
  'Activa una capa IA para operar con más claridad.',
];

const consoleLogs = [
  '[OS] Núcleo comercial sincronizado',
  '[IA] Riesgo de stock bajo detectado',
  '[DATA] Flujo de pedidos estable',
  '[OPS] Clientes listos para seguimiento',
  '[AI] Analizando tendencia de ingresos',
  '[INV] 4 productos requieren reposición',
  '[CRM] 12 clientes con alta intención',
  '[PAY] Facturación mensual verificada',
  '[TEAM] Equipo operativo activo',
  '[POS] Ventas recientes sincronizadas',
];

const revenueValues = ['$12.4k', '$18.9k', '$24.2k', '$31.8k', '$42.6k'];
const orderValues = ['48', '126', '248', '391', '482'];
const alertValues = ['3', '7', '12', '9', '5'];

const telemetrySets = [
  [72, 88, 54, 94, 68, 82],
  [78, 91, 61, 86, 74, 88],
  [66, 83, 58, 97, 71, 79],
  [82, 89, 63, 92, 77, 90],
];

const moduleStateSets = [
  [
    { label: 'Panel ejecutivo', state: 'active' },
    { label: 'Inventario', state: 'watch' },
    { label: 'Clientes', state: 'syncing' },
    { label: 'Copilot IA', state: 'active' },
  ],
  [
    { label: 'Panel ejecutivo', state: 'active' },
    { label: 'Inventario', state: 'active' },
    { label: 'Clientes', state: 'watch' },
    { label: 'Copilot IA', state: 'syncing' },
  ],
  [
    { label: 'Panel ejecutivo', state: 'syncing' },
    { label: 'Inventario', state: 'active' },
    { label: 'Clientes', state: 'active' },
    { label: 'Copilot IA', state: 'watch' },
  ],
];

function useTypewriterRotator(lines: string[]) {
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentLine = lines[lineIndex];
    const typingDelay = isDeleting ? 28 : 42;
    const pauseDelay = isDeleting ? 500 : 1800;

    const timeout = window.setTimeout(() => {
      if (!isDeleting) {
        const nextText = currentLine.slice(0, displayedText.length + 1);
        setDisplayedText(nextText);
        if (nextText === currentLine) {
          setIsDeleting(true);
        }
      } else {
        const nextText = currentLine.slice(0, Math.max(0, displayedText.length - 1));
        setDisplayedText(nextText);
        if (nextText.length === 0) {
          setIsDeleting(false);
          setLineIndex((current) => (current + 1) % lines.length);
        }
      }
    }, displayedText === currentLine || displayedText.length === 0 ? pauseDelay : typingDelay);

    return () => window.clearTimeout(timeout);
  }, [displayedText, isDeleting, lineIndex, lines]);

  return displayedText;
}

function useRotatingConsoleData() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((current) => (current + 1) % 20);
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

  const visibleLogs = useMemo(() => {
    const start = tick % consoleLogs.length;
    return Array.from({ length: 4 }, (_, index) => consoleLogs[(start + index) % consoleLogs.length]);
  }, [tick]);

  return {
    visibleLogs,
    revenue: revenueValues[tick % revenueValues.length],
    orders: orderValues[tick % orderValues.length],
    alerts: alertValues[tick % alertValues.length],
    telemetry: telemetrySets[tick % telemetrySets.length],
    modules: moduleStateSets[tick % moduleStateSets.length],
  };
}

function LiveOperatingConsole() {
  const { visibleLogs, revenue, orders, alerts, telemetry, modules: activeModules } = useRotatingConsoleData();

  return (
    <div className="landing-console-wrap relative mx-auto w-full max-w-[640px]">
      <div className="landing-console-glow absolute inset-6 rounded-[36px] bg-blue-500/12 blur-[70px]" />
      <div className="shell-panel landing-console relative overflow-hidden rounded-[32px]">
        <div className="landing-console-scan absolute inset-x-0 top-0 h-[160px]" />

        <div className="flex h-12 items-center border-b border-white/6 bg-white/[0.02] px-4">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((item) => (
              <span key={item} className="h-2.5 w-2.5 rounded-full border border-white/10 bg-white/10" />
            ))}
          </div>
          <div className="mx-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            <Radar className="h-3 w-3 text-blue-300" />
            REMIX-OS.CONSOLE
          </div>
        </div>

        <div className="grid gap-4 bg-[rgba(7,10,14,0.97)] p-4 md:grid-cols-[0.86fr_1.14fr] md:p-6">
          <div className="space-y-4">
            <div className="surface-elevated p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="section-kicker !text-neutral-400">Estado del sistema</span>
                <span className="telemetry-chip !px-2.5 !py-1">
                  <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
                  EN VIVO
                </span>
              </div>
              <div className="space-y-2 overflow-hidden font-mono text-[11px] text-neutral-400">
                <AnimatePresence mode="popLayout" initial={false}>
                  {visibleLogs.map((log) => (
                    <motion.p
                      key={log}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.28 }}
                    >
                      {log}
                    </motion.p>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="surface-elevated p-4">
              <p className="section-kicker mb-3 !text-neutral-400">Módulos activos</p>
              <div className="space-y-2">
                {activeModules.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
                    <span className="text-sm text-neutral-300">{item.label}</span>
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]',
                        item.state === 'active'
                          ? 'bg-emerald-400 text-emerald-400'
                          : item.state === 'watch'
                            ? 'bg-amber-300 text-amber-300'
                            : 'bg-blue-300 text-blue-300'
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Ingresos 30d', value: revenue, accent: 'text-blue-300' },
                { label: 'Pedidos', value: orders, accent: 'text-emerald-300' },
                { label: 'Alertas IA', value: alerts, accent: 'text-amber-300' },
              ].map((card) => (
                <div key={card.label} className="data-tile !p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{card.label}</p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={card.value}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      className={cn('text-xl font-bold', card.accent)}
                    >
                      {card.value}
                    </motion.p>
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <div className="surface-elevated p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="section-kicker mb-2">Telemetría ejecutiva</p>
                  <h3 className="text-lg font-semibold text-white">Live Operating Console</h3>
                </div>
                <BarChart3 className="h-5 w-5 text-blue-300" />
              </div>

              <div className="space-y-3">
                {telemetry.map((width, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="w-10 text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-600">N{index + 1}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.8, ease: 'easeInOut' }}
                        className="h-full rounded-full bg-[linear-gradient(90deg,#4d7cff,#7cb8ff)]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-blue-400/12 bg-blue-500/8 p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">CAPA IA</p>
                  <p className="text-sm leading-relaxed text-neutral-200">
                    Prioriza clientes, detecta presión de inventario y resume el pulso comercial.
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-white/[0.02] p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">VISTA PREMIUM</p>
                  <p className="text-sm leading-relaxed text-neutral-300">
                    Un solo espacio para operar ventas, equipo, inventario y decisiones críticas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const dynamicLine = useTypewriterRotator(typewriterLines);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      <nav className="sticky top-0 z-50 border-b border-white/6 bg-[rgba(3,4,7,0.72)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <RemixLogo compact />

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden items-center gap-5 text-sm text-neutral-400 lg:flex">
              <a href="#plataforma" className="transition-colors hover:text-white">Plataforma</a>
              <a href="#modulos" className="transition-colors hover:text-white">Módulos</a>
              <a href="#ia" className="transition-colors hover:text-white">Operador IA</a>
            </div>
            <LanguageSwitcher />
            <Link to="/auth">
              <Button variant="secondary" className="h-11 rounded-2xl border-none bg-white px-4 text-black hover:bg-neutral-200 sm:px-6">
                Entrar a Remix OS
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-18">
          <div className="absolute inset-0 hero-gradient opacity-70" />
          <div className="absolute inset-0 grid-bg opacity-15" />
          <div className="absolute left-1/2 top-12 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-blue-500/12 blur-[120px] sm:h-[460px] sm:w-[460px]" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.97fr_1.03fr] lg:gap-16">
            <div className="max-w-2xl pt-4 sm:pt-8">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/14 bg-blue-500/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-blue-200">
                  <span className="status-dot pulse-live bg-blue-400 text-blue-400" />
                  REMIX OS · AI BUSINESS OPERATING SYSTEM
                </div>
                <div className="telemetry-chip !px-3 !py-1.5">Beta pública</div>
              </div>

              <h1 className="font-display text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl xl:text-[74px] xl:leading-[0.96]">
                El sistema operativo inteligente para negocios modernos
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
                Centraliza ventas, inventario, clientes y decisiones con una capa IA diseñada para operar, no solo responder.
              </p>

              <div className="mt-6 min-h-[64px] max-w-xl rounded-[22px] border border-white/8 bg-white/[0.025] px-4 py-4">
                <p className="section-kicker mb-2 !text-neutral-500">Señal operativa</p>
                <div className="flex items-center gap-2 text-base font-medium text-white sm:text-lg">
                  <span>{dynamicLine}</span>
                  <span className="landing-caret h-5 w-[2px] rounded-full bg-blue-300/80" />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button className="h-14 w-full rounded-2xl bg-white px-7 text-black hover:bg-neutral-200 sm:w-auto">
                    Entrar a la consola <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#plataforma" className="w-full sm:w-auto">
                  <Button variant="ghost" className="h-14 w-full rounded-2xl border border-white/10 px-7 text-white hover:bg-white/[0.05] sm:w-auto">
                    Ver capacidades
                  </Button>
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {['Multi-tenant', 'IA operativa', 'Ventas + Inventario', 'Beta pública'].map((item, index) => (
                  <div key={item} className="telemetry-chip !px-3 !py-2">
                    <span
                      className={cn(
                        'status-dot',
                        index === 1
                          ? 'bg-blue-300 text-blue-300'
                          : index === 3
                            ? 'bg-amber-300 text-amber-300'
                            : 'bg-emerald-400 text-emerald-400'
                      )}
                    />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Vista ejecutiva', value: 'Panel en vivo' },
                  { label: 'Operación central', value: 'Ventas + clientes' },
                  { label: 'Capa de decisión', value: 'Señales accionables' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/[0.025] p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{item.label}</p>
                    <p className="text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div id="plataforma" className="w-full self-center">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
              >
                <LiveOperatingConsole />
              </motion.div>
            </div>
          </div>
        </section>

        <section id="modulos" className="border-t border-white/6 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl">
              <p className="section-kicker mb-3">Módulos principales</p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Todo lo importante en un solo sistema operativo comercial.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-neutral-400">
                Sin tarjetas genéricas ni pantallas aisladas: una misma superficie para vender, medir y decidir.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => (
                <motion.div
                  key={module.title}
                  whileHover={{ y: -4 }}
                  className="surface-elevated p-6 transition-transform"
                >
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] ${module.tone}`}>
                    <module.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{module.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400">{module.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="ia" className="border-y border-white/6 bg-[rgba(7,10,14,0.96)] px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_0.9fr]">
            <div className="max-w-2xl">
              <p className="section-kicker mb-3">Operador IA</p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Inteligencia operativa integrada en cada movimiento del negocio.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-neutral-400 sm:text-lg">
                Copilot observa ingresos, clientes y stock para decirte qué importa ahora, sin ruido y con foco en ejecución.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  'Detecta presión de inventario antes de que afecte ventas.',
                  'Resume el pulso comercial con lenguaje claro y accionable.',
                  'Conecta señales reales del negocio con la siguiente decisión.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/12 text-blue-300">
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-elevated overflow-hidden p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="section-kicker mb-2">Vigilancia IA</p>
                  <h3 className="text-lg font-semibold text-white">Señales en tiempo real</h3>
                </div>
                <Layers className="h-5 w-5 text-blue-300" />
              </div>

              <div className="space-y-3">
                {[
                  {
                    title: 'Reposición recomendada',
                    body: 'Dos productos están entrando en zona de stock crítico para la próxima ventana de pedidos.',
                  },
                  {
                    title: 'Clientes con atención pendiente',
                    body: 'La cola comercial tiene oportunidades de seguimiento activas que pueden acelerar conversión.',
                  },
                  {
                    title: 'Pulso de ingresos estable',
                    body: 'La última semana mantiene tracción positiva y sin caídas abruptas en el flujo operativo.',
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, delay: index * 0.08 }}
                    className="rounded-[22px] border border-white/8 bg-white/[0.025] p-4"
                  >
                    <p className="mb-2 text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-sm leading-relaxed text-neutral-400">{item.body}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Entra a una interfaz pensada para operar con claridad.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
              Remix OS convierte la operación diaria en una experiencia más limpia, rápida y enfocada en decisiones.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button className="h-14 w-full rounded-2xl bg-blue-600 px-8 text-white hover:bg-blue-500 sm:w-auto">
                  Entrar a Remix OS
                </Button>
              </Link>
              <a href="#plataforma" className="w-full sm:w-auto">
                <Button variant="ghost" className="h-14 w-full rounded-2xl border border-white/10 px-8 text-white hover:bg-white/[0.05] sm:w-auto">
                  Ver plataforma
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/6 bg-black px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-sm">
            <RemixLogo compact className="mb-3" />
            <p className="text-sm leading-relaxed text-neutral-500">
              Sistema operativo comercial con capa IA para equipos que quieren operar mejor.
            </p>
          </div>

          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-600">
            © 2026 Remix OS
          </div>
        </div>
      </footer>
    </div>
  );
}

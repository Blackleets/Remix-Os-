import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Cpu,
  Layers,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '../components/Common';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

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

function PlatformPreview() {
  return (
    <div className="shell-panel overflow-hidden rounded-[28px]">
      <div className="flex h-11 items-center border-b border-white/6 bg-white/[0.02] px-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((item) => (
            <span key={item} className="h-2.5 w-2.5 rounded-full border border-white/10 bg-white/10" />
          ))}
        </div>
        <div className="mx-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-neutral-500">
          <ShieldCheck className="h-3 w-3" />
          remix-os.console
        </div>
      </div>

      <div className="grid gap-4 bg-[rgba(7,10,14,0.96)] p-4 md:grid-cols-[0.8fr_1.2fr] md:p-6">
        <div className="space-y-4">
          <div className="surface-elevated p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="section-kicker !text-neutral-400">Estado del sistema</span>
              <span className="telemetry-chip !px-2.5 !py-1">
                <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
                En vivo
              </span>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-neutral-400">
              <p>[OS] Núcleo comercial sincronizado</p>
              <p>[IA] Riesgo de stock bajo detectado</p>
              <p>[DATA] Flujo de pedidos estable</p>
              <p>[OPS] Clientes listos para seguimiento</p>
            </div>
          </div>

          <div className="surface-elevated p-4">
            <p className="section-kicker mb-3 !text-neutral-400">Módulos activos</p>
            <div className="space-y-2">
              {['Panel ejecutivo', 'Inventario', 'Clientes', 'Copilot IA'].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
                  <span className="text-sm text-neutral-300">{item}</span>
                  <span className={`h-2 w-2 rounded-full ${index === 1 ? 'bg-amber-300' : 'bg-emerald-400'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Ingresos 30d', value: '$128.4k', accent: 'text-blue-300' },
              { label: 'Pedidos', value: '482', accent: 'text-emerald-300' },
              { label: 'Alertas IA', value: '12', accent: 'text-amber-300' },
            ].map((card) => (
              <div key={card.label} className="data-tile !p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{card.label}</p>
                <p className={`text-xl font-bold ${card.accent}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="surface-elevated p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="section-kicker mb-2">Telemetría ejecutiva</p>
                <h3 className="text-lg font-semibold text-white">Centro operativo Remix OS</h3>
              </div>
              <BarChart3 className="h-5 w-5 text-blue-300" />
            </div>

            <div className="space-y-3">
              {[72, 88, 54, 94, 68, 82].map((height, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="w-10 text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-600">N{index + 1}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${height}%` }}
                      transition={{ duration: 0.7, delay: index * 0.08 }}
                      className="h-full rounded-full bg-[linear-gradient(90deg,#4d7cff,#7cb8ff)]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-blue-400/12 bg-blue-500/8 p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Capa IA</p>
                <p className="text-sm leading-relaxed text-neutral-200">
                  Prioriza clientes, detecta presión de inventario y resume el pulso comercial.
                </p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/[0.02] p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Vista premium</p>
                <p className="text-sm leading-relaxed text-neutral-300">
                  Un solo espacio para operar ventas, equipo, inventario y decisiones críticas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      <nav className="sticky top-0 z-50 border-b border-white/6 bg-[rgba(3,4,7,0.72)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white text-black shadow-[0_12px_28px_rgba(255,255,255,0.08)]">
              <div className="h-4 w-4 rounded-sm bg-black rotate-45" />
            </div>
            <div>
              <p className="section-kicker !tracking-[0.26em] text-blue-300/80">Sistema operativo IA</p>
              <span className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">Remix OS</span>
            </div>
          </div>

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

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
            <div className="max-w-2xl pt-4 sm:pt-8">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/14 bg-blue-500/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-blue-200">
                <span className="status-dot pulse-live bg-blue-400 text-blue-400" />
                Remix OS v1.0
              </div>

              <h1 className="font-display text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl xl:text-[74px] xl:leading-[0.96]">
                Opera tu negocio con una interfaz premium y una capa IA realmente útil.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
                Remix OS unifica clientes, inventario, pedidos y vigilancia operativa en un núcleo oscuro, preciso y listo para crecer contigo.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button className="h-14 w-full rounded-2xl bg-white px-7 text-black hover:bg-neutral-200 sm:w-auto">
                    Entrar a Remix OS <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#plataforma" className="w-full sm:w-auto">
                  <Button variant="ghost" className="h-14 w-full rounded-2xl border border-white/10 px-7 text-white hover:bg-white/[0.05] sm:w-auto">
                    Ver plataforma
                  </Button>
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Visión ejecutiva', value: 'Dashboard vivo' },
                  { label: 'Operación central', value: 'Clientes + pedidos' },
                  { label: 'Asistencia IA', value: 'Señales accionables' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/[0.025] p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{item.label}</p>
                    <p className="text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div id="plataforma" className="w-full">
              <PlatformPreview />
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
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black">
                <div className="h-3.5 w-3.5 rotate-45 rounded-sm bg-black" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">Remix OS</span>
            </div>
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

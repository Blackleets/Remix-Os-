import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { motion } from 'motion/react';
import { ArrowLeft, Cpu, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { auth, googleProvider } from '../lib/firebase';
import { useLocale } from '../hooks/useLocale';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function Auth() {
  const { user, company, loading } = useAuth();
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err?.message || t('auth.errors.google_sign_in'));
    }
  };

  if (loading) return null;
  if (user) return <Navigate to={company ? '/dashboard' : '/onboarding'} replace />;

  return (
    <div className="min-h-screen overflow-hidden bg-black text-white selection:bg-blue-500 selection:text-white">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:34px_34px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_45%,#000_65%,transparent_100%)]" />
      <div className="absolute left-[12%] top-[14%] h-[280px] w-[280px] rounded-full bg-blue-600/12 blur-[120px]" />
      <div className="absolute bottom-[8%] right-[8%] h-[240px] w-[240px] rounded-full bg-white/6 blur-[120px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-neutral-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/14 bg-blue-500/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">
              <span className="status-dot pulse-live bg-blue-400 text-blue-400" />
              Acceso al sistema
            </div>

            <h1 className="font-display text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              Entra a tu núcleo operativo con una sola capa de acceso.
            </h1>

            <p className="mt-5 text-base leading-relaxed text-neutral-400 sm:text-lg">
              Remix OS abre tu consola comercial, conecta tu identidad y te lleva directo a la operación o al onboarding.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: 'Acceso seguro', desc: 'Autenticación centralizada' },
                { icon: Cpu, title: 'Capa IA', desc: 'Operador listo al entrar' },
                { icon: Zap, title: 'Inicio rápido', desc: 'Empresa y flujo en minutos' },
              ].map((item) => (
                <div key={item.title} className="rounded-[22px] border border-white/8 bg-white/[0.025] p-4">
                  <item.icon className="mb-3 h-5 w-5 text-blue-300" />
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="shell-panel relative mx-auto w-full max-w-xl overflow-hidden rounded-[30px] p-5 sm:p-7"
          >
            <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(77,124,255,0.18),transparent_72%)]" />

            <div className="relative">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 bg-white text-black shadow-[0_16px_34px_rgba(255,255,255,0.08)]">
                    <div className="h-5 w-5 rotate-45 rounded-sm bg-black" />
                  </div>
                  <div>
                    <p className="section-kicker mb-2">Remix OS</p>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      Consola de acceso
                    </h2>
                  </div>
                </div>
                <span className="telemetry-chip !px-2.5 !py-1">
                  <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
                  Lista
                </span>
              </div>

              <div className="mb-6 rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.025)] p-5">
                <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">
                  Accede de forma segura a tu espacio operativo y crea tu empresa en minutos.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="telemetry-chip !px-2.5 !py-1">Google Auth</span>
                  <span className="telemetry-chip !px-2.5 !py-1">Onboarding guiado</span>
                  <span className="telemetry-chip !px-2.5 !py-1">Sistema operativo IA</span>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-5 rounded-[20px] border border-red-500/18 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </motion.div>
              )}

              <Button
                onClick={handleGoogleLogin}
                className="h-16 w-full rounded-[22px] bg-white text-base font-bold text-black shadow-[0_18px_34px_rgba(255,255,255,0.08)] transition-all hover:bg-neutral-100"
              >
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuar con Google
              </Button>

              <div className="mt-6 rounded-[22px] border border-white/6 bg-white/[0.02] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
                  Entrada segura
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  Tus datos viajan cifrados y tu acceso queda vinculado a tu espacio de trabajo operativo.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

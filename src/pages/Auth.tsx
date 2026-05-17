import { FormEvent, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Github, LockKeyhole, Mail, ShieldCheck, Store, Zap } from 'lucide-react';
import { Button, Input, Label, OSGlyph, cn } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { RemixLogo } from '../components/brand/RemixLogo';

type AuthMode = 'signin' | 'signup';
type AuthAction = 'google' | 'github' | 'email' | 'reset' | null;

export function Auth() {
  const {
    user,
    company,
    loading,
    signInWithGoogle,
    signInWithGithub,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<AuthAction>(null);

  if (loading) return null;
  if (user) return <Navigate to={company ? '/dashboard' : '/onboarding'} replace />;

  const runAuthAction = async (action: AuthAction, callback: () => Promise<void>) => {
    try {
      setActiveAction(action);
      setError(null);
      setSuccess(null);
      await callback();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos completar el acceso. Intentalo de nuevo.');
    } finally {
      setActiveAction(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Escribe tu email para continuar.');
      return;
    }
    if (!password) {
      setError('Escribe tu contrasena para continuar.');
      return;
    }

    void runAuthAction('email', () =>
      mode === 'signin'
        ? signInWithEmail(trimmedEmail, password)
        : signUpWithEmail(trimmedEmail, password)
    );
  };

  const handleResetPassword = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Escribe tu email y despues solicita recuperar contrasena.');
      return;
    }

    void runAuthAction('reset', async () => {
      await resetPassword(trimmedEmail);
      setSuccess('Te enviamos un email para recuperar tu contrasena.');
    });
  };

  const isBusy = activeAction !== null;

  return (
    <div className="min-h-screen overflow-hidden bg-[#050607] text-white selection:bg-blue-500 selection:text-white">
      <div className="absolute inset-0 bg-grid-white/[0.025] bg-[size:34px_34px] [mask-image:radial-gradient(ellipse_72%_68%_at_50%_42%,#000_64%,transparent_100%)]" />
      <div className="absolute left-[8%] top-[10%] h-[240px] w-[240px] rounded-full bg-blue-600/12 blur-[120px]" />
      <div className="absolute bottom-[7%] right-[6%] h-[260px] w-[260px] rounded-full bg-emerald-400/8 blur-[120px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-neutral-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="grid flex-1 items-center gap-8 pb-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/14 bg-blue-500/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">
              <span className="status-dot pulse-live bg-blue-400 text-blue-400" />
              Acceso Remix OS
            </div>

            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              Tu consola operativa, con acceso flexible y seguro.
            </h1>

            <p className="mt-5 text-base leading-relaxed text-neutral-400 sm:text-lg">
              Entra con Google, GitHub o email. Si eres nuevo, Remix OS te lleva al onboarding sin crear empresas duplicadas.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: 'Auth seguro', desc: 'Firebase maneja credenciales' },
                { icon: Store, title: 'Empresa intacta', desc: 'Memberships sin cambios' },
                { icon: Zap, title: 'Onboarding', desc: 'Nuevo usuario al flujo actual' },
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
            className="shell-panel relative mx-auto w-full max-w-xl overflow-hidden rounded-[30px] p-4 sm:p-7"
          >
            <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(77,124,255,0.18),transparent_72%)]" />

            <div className="relative">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <RemixLogo compact />
                </div>
                <span className="telemetry-chip !px-2.5 !py-1">
                  <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
                  Seguro
                </span>
              </div>

              <div className="mb-5 grid grid-cols-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1">
                {[
                  { id: 'signin', label: 'Iniciar sesion' },
                  { id: 'signup', label: 'Crear cuenta' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMode(item.id as AuthMode);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={cn(
                      'rounded-[14px] px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition-all',
                      mode === item.id ? 'bg-white/[0.1] text-white' : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isBusy}
                  onClick={() => void runAuthAction('google', signInWithGoogle)}
                  className="h-12 gap-2 rounded-[18px] bg-white text-sm font-bold text-black hover:bg-neutral-100"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {activeAction === 'google' ? 'Conectando...' : 'Google'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isBusy}
                  onClick={() => void runAuthAction('github', signInWithGithub)}
                  className="h-12 gap-2 rounded-[18px]"
                >
                  <Github className="h-4 w-4" />
                  {activeAction === 'github' ? 'Conectando...' : 'GitHub'}
                </Button>
              </div>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/8" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">o usa email</span>
                <div className="h-px flex-1 bg-white/8" />
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                    <Input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="tu@email.com"
                      className="pl-11"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Label>Password</Label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={isBusy}
                        className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200 transition-colors hover:text-blue-100 disabled:opacity-50"
                      >
                        Olvide mi contrasena
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                    <Input
                      type="password"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'signin' ? 'Tu contrasena' : 'Minimo 6 caracteres'}
                      className="pl-11"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[18px] border border-red-500/18 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  >
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
                  >
                    {success}
                  </motion.div>
                )}

                <Button type="submit" disabled={isBusy} className="h-14 w-full rounded-[20px] text-base font-bold">
                  {activeAction === 'email'
                    ? mode === 'signin'
                      ? 'Entrando...'
                      : 'Creando cuenta...'
                    : mode === 'signin'
                      ? 'Iniciar sesion'
                      : 'Crear cuenta gratis'}
                </Button>
              </form>

              <div className="mt-5 rounded-[22px] border border-white/6 bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <OSGlyph tone="blue" size="sm">
                    <ShieldCheck className="h-4 w-4" />
                  </OSGlyph>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">
                      Entrada segura
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                      Remix OS nunca guarda passwords. Firebase Auth controla proveedores, sesiones y recuperacion.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-5 text-center text-sm text-neutral-500">
                {mode === 'signin' ? 'No tienes cuenta?' : 'Ya tienes cuenta?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="font-semibold text-blue-200 transition-colors hover:text-blue-100"
                >
                  {mode === 'signin' ? 'Crear cuenta gratis' : 'Iniciar sesion'}
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

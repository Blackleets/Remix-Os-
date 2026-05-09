import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { auth, googleProvider } from '../lib/firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'reset';

export function Auth() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  const clearState = () => { setError(null); setSuccess(null); };

  const handleGoogleLogin = async () => {
    clearState();
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      setSuccess('Account created! Check your email to verify your account before signing in.');
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();
    if (!email) { setError('Enter your email address.'); return; }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Reset link sent! Check your inbox (and spam folder).');
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => { clearState(); setMode(m); setPassword(''); setConfirmPassword(''); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6 selection:bg-blue-500 selection:text-white overflow-hidden relative">
      <div className="absolute top-8 right-8 z-50">
        <LanguageSwitcher />
      </div>

      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-w-md w-full bg-neutral-900/40 backdrop-blur-3xl border border-white/[0.08] rounded-[2.5rem] p-8 sm:p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-white rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-2xl shadow-blue-500/20 group cursor-default">
            <div className="w-7 h-7 bg-black rounded-sm rotate-45 group-hover:rotate-90 transition-transform duration-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter text-white font-display">Remix OS</h1>
        </div>

        {/* Mode tabs (only signin/signup) */}
        {mode !== 'reset' && (
          <div className="flex bg-white/5 rounded-xl p-1 mb-8">
            {(['signin', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  mode === m ? 'bg-white text-black shadow' : 'text-neutral-500 hover:text-white'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
        )}

        {/* Reset mode header */}
        {mode === 'reset' && (
          <div className="mb-8">
            <button
              onClick={() => switchMode('signin')}
              className="flex items-center gap-2 text-neutral-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-4"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Sign In
            </button>
            <h2 className="text-lg font-bold text-white">Reset Password</h2>
            <p className="text-xs text-neutral-500 mt-1">We'll send a link to your email.</p>
          </div>
        )}

        {/* Feedback messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 text-red-400 text-xs p-4 rounded-xl border border-red-500/20 mb-6 font-semibold"
            >
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              key="success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-500/10 text-emerald-400 text-xs p-4 rounded-xl border border-emerald-500/20 mb-6 font-semibold flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email/Password form */}
        <form
          onSubmit={mode === 'signin' ? handleEmailSignIn : mode === 'signup' ? handleEmailSignUp : handlePasswordReset}
          className="space-y-4 mb-6"
        >
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
            />
          </div>

          {/* Password (not shown in reset mode) */}
          {mode !== 'reset' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-12 py-3.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Confirm password (signup only) */}
          {mode === 'signup' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
              />
            </div>
          )}

          {/* Forgot password link */}
          {mode === 'signin' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-[11px] text-neutral-500 hover:text-blue-400 transition-colors font-semibold"
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full h-12 rounded-2xl font-bold text-sm"
          >
            {busy ? 'Processing...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </Button>
        </form>

        {/* Divider */}
        {mode !== 'reset' && (
          <>
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-neutral-900 px-4 text-[10px] font-bold uppercase tracking-widest text-neutral-600">or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={busy}
              className="w-full h-12 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm bg-white text-black hover:bg-neutral-100 shadow-lg shadow-white/5 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </>
        )}

        <p className="text-center text-[9px] text-neutral-700 font-bold uppercase tracking-widest mt-8">
          Secure · Encrypted · Private
        </p>
      </motion.div>
    </div>
  );
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
    'auth/cancelled-popup-request': 'Sign-in cancelled.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

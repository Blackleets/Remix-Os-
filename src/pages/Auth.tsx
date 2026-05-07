import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { motion } from 'motion/react';

export function Auth() {
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6 selection:bg-blue-500 selection:text-white overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-w-md w-full bg-neutral-900/40 backdrop-blur-3xl border border-white/[0.08] rounded-[2.5rem] p-8 sm:p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]"
      >
        <div className="text-center mb-8 sm:mb-12">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-6 sm:mb-8 flex items-center justify-center shadow-2xl shadow-blue-500/20 group cursor-default">
            <div className="w-8 h-8 bg-black rounded-sm rotate-45 group-hover:rotate-90 transition-transform duration-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter mb-3 text-white font-display">Remix OS <span className="text-neutral-500">v1.0</span></h1>
          <p className="text-neutral-400 text-sm leading-relaxed max-w-[260px] mx-auto font-medium">
            Welcome back. Securely sign in to your business workspace.
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 text-red-400 text-[10px] p-4 rounded-xl border border-red-500/20 mb-8 font-black uppercase tracking-widest text-center"
          >
            {error}
          </motion.div>
        )}

        <Button 
          onClick={handleGoogleLogin}
          className="w-full h-16 rounded-2xl flex items-center justify-center gap-4 font-bold transition-all active:scale-[0.98] bg-white text-black hover:bg-neutral-100 shadow-xl shadow-white/5"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </Button>

        <div className="mt-12 pt-8 border-t border-white/5 italic">
          <p className="text-center text-[9px] text-neutral-600 font-bold uppercase tracking-[0.3em] leading-relaxed">
            Secure business management platform.<br/>
            Your data is encrypted and secure.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../components/Common';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ open: false, title: '', message: '' });
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    setState({ ...opts, open: true });
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const handle = (result: boolean) => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl shadow-black max-w-sm w-full p-8"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${state.danger ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">{state.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed mb-8">{state.message}</p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => handle(false)}
                >
                  {state.cancelLabel || 'Cancel'}
                </Button>
                <Button
                  className={`flex-1 ${state.danger ? 'bg-red-600 hover:bg-red-500' : ''}`}
                  onClick={() => handle(true)}
                >
                  {state.confirmLabel || 'Confirm'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

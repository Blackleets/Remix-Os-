
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from './Common';
import { Zap, AlertTriangle, X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  limitName: string;
}

export function UpgradeModal({ isOpen, onClose, title, message, limitName }: UpgradeModalProps) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-neutral-900 w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-4">
              <button 
                onClick={onClose}
                className="p-2 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                <Zap className="w-8 h-8 text-blue-500" />
              </div>
              
              <h2 className="font-display text-2xl font-bold text-white mb-2 uppercase tracking-tight">
                {title || 'Quota Exhausted'}
              </h2>
              
              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl mb-6">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-neutral-400 italic leading-relaxed">
                  You have reached the maximum allocation for <span className="text-white font-bold">{limitName}</span> on your current protocol. Upgrade to unlock higher throughput.
                </p>
              </div>

              <p className="text-sm text-neutral-500 mb-8 leading-relaxed">
                {message || "Scale your operational capacity and transition to a more advanced command tier."}
              </p>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => {
                    navigate('/billing');
                    onClose();
                  }}
                  className="w-full py-6 rounded-xl flex gap-2 justify-center"
                >
                  <Zap className="w-4 h-4" /> Upgrade Protocol
                </Button>
                <Button 
                  variant="secondary"
                  onClick={onClose}
                  className="w-full py-4 text-xs font-bold tracking-widest"
                >
                  Dismiss
                </Button>
              </div>
            </div>
            
            <div className="bg-white/[0.02] p-4 border-t border-white/[0.05] text-center">
              <p className="text-[9px] text-neutral-600 uppercase font-bold tracking-[0.2em]">Remix OS • Subscription Firewall</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

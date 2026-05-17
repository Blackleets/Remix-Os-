import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Grip, Store, Receipt, Database, MoreHorizontal, X, User, Package, Shield, Sparkle, CreditCard, Settings } from 'lucide-react';
import { useState } from 'react';
import { cn } from './Common';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';

const PRIMARY_ROUTES = [
  { icon: Grip, labelKey: 'nav.dashboard', path: '/dashboard' },
  { icon: Store, labelKey: 'nav.pos', path: '/pos' },
  { icon: Receipt, labelKey: 'nav.orders', path: '/orders' },
  { icon: User, labelKey: 'nav.customers', path: '/customers' },
];

export function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const { role } = useAuth();
  const { canAccessSuperAdmin } = usePlatformAdmin();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const moreItems = [
    { icon: Database, labelKey: 'nav.inventory', path: '/inventory' },
    { icon: Package, labelKey: 'nav.products', path: '/products' },
    { icon: Sparkle, labelKey: 'nav.insights', path: '/insights', restricted: ['owner', 'admin'] },
    { icon: Shield, labelKey: 'nav.team', path: '/team' },
    { icon: CreditCard, labelKey: 'nav.billing', path: '/billing', restricted: ['owner', 'admin'] },
    { icon: Settings, labelKey: 'nav.settings', path: '/settings' },
  ].filter(item => !item.restricted || item.restricted.includes(role || ''));

  const isMoreActive = moreItems.some(item => location.pathname === item.path);

  return (
    <>
      {isMoreOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsMoreOpen(false)}
          className="fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {isMoreOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className="bottom-nav-sheet-pos fixed left-4 right-4 z-[60] rounded-3xl border border-white/10 bg-[rgba(6,8,12,0.96)] p-3 shadow-2xl backdrop-blur-2xl lg:hidden"
        >
          <div className="mb-2 flex items-center justify-between px-2 pb-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Más opciones</p>
            <button onClick={() => setIsMoreOpen(false)} className="text-neutral-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {moreItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-all',
                    isActive
                      ? 'border-blue-400/20 bg-blue-500/10 text-white'
                      : 'border-white/6 bg-white/[0.03] text-neutral-500 active:bg-white/[0.06]'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wide">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-[58] border-t border-white/8 bg-[rgba(6,8,12,0.95)] pb-safe backdrop-blur-2xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-2 py-1">
          {PRIMARY_ROUTES.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className="flex flex-1 flex-col items-center py-2">
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 transition-all',
                    isActive ? 'text-white' : 'text-neutral-600 active:text-neutral-300'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-indicator"
                      className="absolute -top-[1px] h-[2px] w-10 rounded-full bg-blue-400 shadow-[0_0_14px_rgba(96,165,250,0.8)]"
                    />
                  )}
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                    isActive ? 'bg-blue-500/20 text-blue-200' : 'text-neutral-600'
                  )}>
                    <item.icon className="h-[18px] w-[18px]" />
                  </div>
                  <span className="max-w-[56px] truncate text-[9px] font-black uppercase tracking-widest">{t(item.labelKey)}</span>
                </motion.div>
              </Link>
            );
          })}

          <button
            onClick={() => setIsMoreOpen(v => !v)}
            className="flex flex-1 flex-col items-center py-2"
          >
            <motion.div
              whileTap={{ scale: 0.85 }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 transition-all',
                isMoreActive || isMoreOpen ? 'text-white' : 'text-neutral-600 active:text-neutral-300'
              )}
            >
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                isMoreActive || isMoreOpen ? 'bg-blue-500/20 text-blue-200' : 'text-neutral-600'
              )}>
                {isMoreOpen ? <X className="h-[18px] w-[18px]" /> : <MoreHorizontal className="h-[18px] w-[18px]" />}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest">Más</span>
            </motion.div>
          </button>
        </div>
      </nav>
    </>
  );
}

import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Grip, 
  User, 
  Package, 
  Database, 
  Receipt, 
  Store,
  Shield, 
  Sparkle, 
  CreditCard, 
  Settings, 
  LogOut,
  X,
  Radar
} from 'lucide-react';
import { cn } from './Common';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { company, role } = useAuth();
  const { t } = useTranslation();
  const { canAccessSuperAdmin } = usePlatformAdmin();

  const navItems = [
    { icon: Grip, label: t('nav.dashboard'), path: '/dashboard' },
    { icon: User, label: t('nav.customers'), path: '/customers' },
    { icon: Package, label: t('nav.products'), path: '/products' },
    { icon: Database, label: t('nav.inventory'), path: '/inventory' },
    { icon: Receipt, label: t('nav.orders'), path: '/orders' },
    { icon: Store, label: t('nav.pos'), path: '/pos' },
    { icon: Shield, label: t('nav.team'), path: '/team' },
    { icon: Sparkle, label: t('nav.insights'), path: '/insights' },
    { icon: CreditCard, label: t('nav.billing'), path: '/billing' },
    ...(canAccessSuperAdmin ? [{ icon: Radar, label: t('nav.super_admin'), path: '/super-admin' }] : []),
  ];

  return (
    <aside className="w-full lg:w-64 border-r border-white/5 h-full lg:h-screen flex flex-col bg-black lg:sticky lg:top-0 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="flex items-center gap-3 group" onClick={onClose}>
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110">
              <div className="w-4 h-4 bg-black rounded-sm group-hover:rounded-full transition-all duration-500" />
            </div>
            <span className="font-display font-medium text-lg tracking-tight text-white uppercase italic">Remix</span>
          </Link>
          <button 
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-white lg:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-10">
          <p className="text-[9px] font-black text-neutral-800 uppercase tracking-[0.4em] mb-4">Registry</p>
          <div className="flex items-center gap-3 px-3 py-3 bg-white/[0.02] rounded-2xl border border-white/[0.04] group hover:border-white/[0.1] transition-all duration-300">
            <div className="w-9 h-9 bg-blue-600/10 border border-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 font-bold text-xs shadow-inner overflow-hidden">
              {company?.logoURL ? (
                <img src={company.logoURL} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                company?.name?.[0] || 'B'
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-neutral-200 truncate tracking-tight">{company?.name || 'Main Grid'}</p>
              <p className="text-[9px] text-neutral-600 truncate uppercase font-black tracking-widest leading-tight">{company?.industry || 'System Root'}</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          <p className="text-[9px] font-black text-neutral-800 uppercase tracking-[0.4em] mb-4">Operations</p>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            if (item.path === '/billing' && role !== 'owner' && role !== 'admin') {
              return null;
            }
            if (item.path === '/insights' && role !== 'owner' && role !== 'admin') {
              return null;
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className="block"
              >
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] transition-all duration-300 group relative uppercase tracking-widest font-black',
                    isActive 
                      ? 'bg-blue-600/10 text-white border border-blue-500/10 shadow-[0_4px_20px_rgba(59,130,246,0.05)]' 
                      : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.03]'
                  )}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="activeNav"
                      className="absolute left-1 w-0.5 h-3 bg-blue-500 rounded-full"
                    />
                  )}
                  <item.icon className={cn(
                    'w-3.5 h-3.5 transition-all duration-500', 
                    isActive ? 'text-blue-400 scale-110' : 'text-neutral-600 group-hover:text-neutral-400 group-hover:scale-110'
                  )} />
                  {item.label}
                </motion.div>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 space-y-2">
        <Link
          to="/settings"
          onClick={onClose}
          className="block"
        >
          <motion.div
            whileHover={{ x: 4 }}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] transition-all duration-300 uppercase tracking-widest font-black group',
              location.pathname === '/settings' 
                ? 'bg-white/10 text-white border border-white/10' 
                : 'text-neutral-500 hover:text-white hover:bg-white/[0.03]'
            )}
          >
            <Settings className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-700 ease-in-out" />
            {t('nav.settings')}
          </motion.div>
        </Link>
        <button
          onClick={() => signOut(auth)}
          className="block w-full text-left"
        >
          <motion.div
            whileHover={{ x: 4 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] text-red-500/50 hover:text-red-400 hover:bg-red-400/5 transition-all duration-300 uppercase tracking-widest font-black"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('nav.logout')}
          </motion.div>
        </button>
      </div>
    </aside>


  );
}

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
  Radar,
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
    <aside className="h-full w-full overflow-y-auto border-r border-white/6 bg-[rgba(6,8,12,0.92)] backdrop-blur-2xl lg:h-screen lg:w-[300px] lg:sticky lg:top-0">
      <div className="flex min-h-full flex-col px-5 py-5">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" onClick={onClose}>
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(77,124,255,0.35),transparent_60%)] opacity-80" />
              <div className="relative h-5 w-5 rounded-md bg-white transition-all duration-500 group-hover:rotate-45 group-hover:rounded-[10px]" />
            </div>
            <div>
              <p className="section-kicker mb-1 !tracking-[0.26em] text-blue-300/80">Sistema operativo IA</p>
              <span className="font-display text-xl font-bold tracking-tight text-white">Remix OS</span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/8 bg-white/[0.03] p-2 text-neutral-500 transition-colors hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shell-panel mb-6 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="section-kicker !text-neutral-400">Registro de entidad</span>
            <span className="telemetry-chip !px-2.5 !py-1 !text-[9px]">
              <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
              En vivo
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-blue-400/14 bg-blue-500/10 text-sm font-bold text-blue-200">
              {company?.logoURL ? (
                <img src={company.logoURL} alt={company.name} className="h-full w-full object-cover" />
              ) : (
                company?.name?.[0] || 'R'
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{company?.name || 'Núcleo principal'}</p>
              <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                {company?.industry || 'Núcleo operativo'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-[0.28em] text-neutral-600">Operaciones</p>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;

              if (item.path === '/billing' && role !== 'owner' && role !== 'admin') return null;
              if (item.path === '/insights' && role !== 'owner' && role !== 'admin') return null;

              return (
                <Link key={item.path} to={item.path} onClick={onClose} className="block">
                  <motion.div
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.985 }}
                    className={cn(
                      'group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-300',
                      isActive
                        ? 'border border-blue-400/18 bg-blue-500/10 text-white shadow-[0_14px_34px_rgba(61,103,255,0.10)]'
                        : 'border border-transparent text-neutral-500 hover:border-white/8 hover:bg-white/[0.04] hover:text-neutral-200'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-nav"
                        className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-full bg-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.7)]"
                      />
                    )}
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300',
                      isActive
                        ? 'border-blue-300/20 bg-blue-400/10 text-blue-200'
                        : 'border-white/8 bg-white/[0.03] text-neutral-600 group-hover:text-neutral-300'
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <span>{item.label}</span>
                    </div>
                    <span className={cn(
                      'font-mono text-[10px] tracking-normal transition-opacity',
                      isActive ? 'text-blue-200/70' : 'text-neutral-700 group-hover:text-neutral-500'
                    )}>
                      OS
                    </span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto space-y-2 pt-4">
          <Link to="/settings" onClick={onClose} className="block">
            <motion.div
              whileHover={{ x: 3 }}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-300',
                location.pathname === '/settings'
                  ? 'border-white/12 bg-white/[0.05] text-white'
                  : 'border-white/0 text-neutral-500 hover:border-white/8 hover:bg-white/[0.04] hover:text-white'
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                <Settings className="h-4 w-4" />
              </div>
              {t('nav.settings')}
            </motion.div>
          </Link>
          <button onClick={() => signOut(auth)} className="block w-full text-left">
            <motion.div
              whileHover={{ x: 3 }}
              className="flex items-center gap-3 rounded-2xl border border-red-400/0 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-red-300/60 transition-all duration-300 hover:border-red-400/10 hover:bg-red-400/6 hover:text-red-200"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/10 bg-red-400/5">
                <LogOut className="h-4 w-4" />
              </div>
              {t('nav.logout')}
            </motion.div>
          </button>
        </div>
      </div>
    </aside>
  );
}

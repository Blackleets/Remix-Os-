import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  Users, 
  Package, 
  ClipboardList, 
  LayoutDashboard, 
  Settings, 
  LogOut,
  BrainCircuit,
  Boxes,
  ShieldCheck,
  X
} from 'lucide-react';
import { cn } from './Common';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: Boxes, label: 'Inventory', path: '/inventory' },
  { icon: ClipboardList, label: 'Orders', path: '/orders' },
  { icon: ShieldCheck, label: 'Team', path: '/team' },
  { icon: BrainCircuit, label: 'AI Insights', path: '/insights' },
  { icon: BarChart3, label: 'Billing & Plans', path: '/billing' },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { company, role } = useAuth();

  return (
    <aside className="w-full lg:w-64 border-r border-white/5 h-screen flex flex-col bg-black lg:sticky lg:top-0 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="flex items-center gap-3 group" onClick={onClose}>
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
              <div className="w-4 h-4 bg-black rounded-sm" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white">Remix OS</span>
          </Link>
          <button 
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-white lg:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-10">
          <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.2em] mb-4">Enterprise Node</p>
          <div className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] rounded-xl border border-white/[0.05]">
            <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-500 font-bold text-xs">
              {company?.name?.[0] || 'B'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-neutral-200 truncate">{company?.name || 'My Business'}</p>
              <p className="text-[10px] text-neutral-500 truncate uppercase tracking-wider">{company?.industry || 'Core Unit'}</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.2em] mb-4">Core Systems</p>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            // Operational Security: Hide billing from non-privileged roles
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
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative',
                  isActive 
                    ? 'bg-white/10 text-white font-medium shadow-[0_0_20px_rgba(255,255,255,0.05)]' 
                    : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5'
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeNav"
                    className="absolute left-0 w-1 h-4 bg-blue-500 rounded-r-full"
                  />
                )}
                <item.icon className={cn('w-4 h-4 transition-colors', isActive ? 'text-blue-500' : 'text-neutral-600 group-hover:text-neutral-400')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 space-y-2">
        <Link
          to="/settings"
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
            location.pathname === '/settings' 
              ? 'bg-white/5 text-white font-medium' 
              : 'text-neutral-500 hover:text-white hover:bg-white/5'
          )}
        >
          <Settings className="w-4 h-4" />
          System Settings
        </Link>
        <button
          onClick={() => signOut(auth)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-all duration-200 w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Terminate Session
        </button>
      </div>
    </aside>
  );
}

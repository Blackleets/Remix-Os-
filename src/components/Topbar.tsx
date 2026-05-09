import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CircleUser, Menu, Bell, Settings, CreditCard, LogOut, Receipt, UserPlus, Database, History, Cpu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  createdAt: Timestamp;
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, userProfile, company } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const displayName = userProfile?.displayName || user?.displayName || 'User';
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const email = userProfile?.email || user?.email;

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [lastSeen, setLastSeen] = useState<Date>(() => {
    const stored = localStorage.getItem('notif_last_seen');
    return stored ? new Date(stored) : new Date();
  });

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Real-time activity feed
  useEffect(() => {
    if (!company) return;
    const q = query(
      collection(db, 'activities'),
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc'),
      limit(12)
    );
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityItem));
      setActivities(items);
      const newCount = items.filter(a => a.createdAt?.toDate?.() > lastSeen).length;
      setUnread(newCount);
    });
    return unsub;
  }, [company, lastSeen]);

  const handleOpenNotif = () => {
    setNotifOpen(o => !o);
    setProfileOpen(false);
    if (!notifOpen) {
      const now = new Date();
      setLastSeen(now);
      setUnread(0);
      localStorage.setItem('notif_last_seen', now.toISOString());
    }
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    await signOut(auth);
    navigate('/auth');
  };

  const getActivityIcon = (type: string) => {
    if (type.startsWith('order')) return <Receipt className="w-3.5 h-3.5 text-blue-400" />;
    if (type.startsWith('customer')) return <UserPlus className="w-3.5 h-3.5 text-emerald-400" />;
    if (type.startsWith('product')) return <Database className="w-3.5 h-3.5 text-amber-400" />;
    if (type.startsWith('movement') || type.startsWith('inventory')) return <History className="w-3.5 h-3.5 text-purple-400" />;
    if (type.startsWith('ai')) return <Cpu className="w-3.5 h-3.5 text-blue-300" />;
    return <History className="w-3.5 h-3.5 text-neutral-400" />;
  };

  const getRelativeTime = (ts: Timestamp) => {
    if (!ts) return '';
    const diff = Date.now() - ts.toDate().getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  };

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 bg-black/50 backdrop-blur-md sticky top-0 z-30 w-full">
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-neutral-500 hover:text-white lg:hidden transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="relative max-w-md w-full group hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder={t('common.search')}
            className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <LanguageSwitcher />

        {/* Live status */}
        <div className="hidden md:flex items-center gap-1.5 pr-4 border-r border-white/10">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{t('common.live')}</span>
        </div>

        {/* Notifications bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={handleOpenNotif}
            className="relative p-2 text-neutral-500 hover:text-white transition-colors rounded-xl hover:bg-white/5"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] bg-blue-500 rounded-full border-2 border-black text-[8px] font-black flex items-center justify-center text-white px-0.5">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute right-0 top-full mt-2 w-80 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl shadow-black overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-white">Activity</span>
                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider">Live Feed</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {activities.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
                      <p className="text-[10px] text-neutral-600 uppercase font-bold tracking-widest">No activity yet</p>
                    </div>
                  ) : activities.map(a => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-0">
                      <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center shrink-0 mt-0.5">
                        {getActivityIcon(a.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-neutral-200 truncate">{a.title}</p>
                        <p className="text-[10px] text-neutral-500 truncate mt-0.5">{a.subtitle}</p>
                      </div>
                      <span className="text-[9px] text-neutral-700 font-mono shrink-0 mt-1">{getRelativeTime(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
            className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-white/5 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center border border-white/10 shadow-lg group-hover:border-blue-500/30 transition-colors overflow-hidden shrink-0">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <CircleUser className="w-5 h-5 text-neutral-400 group-hover:text-blue-400 transition-colors" />
              )}
            </div>
            <div className="hidden md:flex flex-col items-start">
              <p className="text-[11px] font-bold text-white leading-none truncate max-w-[120px]">{displayName}</p>
              <p className="text-[9px] text-neutral-500 font-mono truncate max-w-[120px]">{email}</p>
            </div>
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl shadow-black overflow-hidden z-50"
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs font-bold text-white truncate">{displayName}</p>
                  <p className="text-[10px] text-neutral-500 truncate">{email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <MenuBtn icon={<Settings className="w-4 h-4" />} label="Settings" onClick={() => { setProfileOpen(false); navigate('/settings'); }} />
                  <MenuBtn icon={<CreditCard className="w-4 h-4" />} label="Billing" onClick={() => { setProfileOpen(false); navigate('/billing'); }} />
                </div>

                <div className="border-t border-white/5 py-1">
                  <MenuBtn
                    icon={<LogOut className="w-4 h-4" />}
                    label="Sign Out"
                    onClick={handleLogout}
                    danger
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function MenuBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-white/5 ${danger ? 'text-red-400 hover:text-red-300' : 'text-neutral-300 hover:text-white'}`}
    >
      {icon}
      {label}
    </button>
  );
}

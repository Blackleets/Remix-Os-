import { Bell, Search, Command, CircleUser, Menu, Inbox, Globe, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../hooks/useLocale';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, userProfile } = useAuth();
  const { t } = useTranslation();
  const { language, setLanguage } = useLocale();

  const displayName = userProfile?.displayName || user?.displayName || 'Unknown Entity';
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const email = userProfile?.email || user?.email;

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
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/5">
            <Command className="w-2.5 h-2.5 text-neutral-500" />
            <span className="text-[10px] font-mono text-neutral-500">K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-6">
        {/* Language Switcher */}
        <LanguageSwitcher />

        <div className="hidden md:flex items-center gap-4 pr-6 border-r border-white/10">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
              {t('common.live')}
            </span>
            <span className="text-[9px] text-neutral-600 font-mono tracking-tighter">NODE_TRANS_12.4</span>
          </div>
          <button className="p-2 text-neutral-500 hover:text-white transition-colors relative">
            <Inbox className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-black shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
          </button>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-xs font-bold text-white truncate max-w-[100px] lg:max-w-none uppercase tracking-tight">{displayName}</p>
            <p className="text-[9px] text-neutral-500 truncate max-w-[100px] lg:max-w-none font-mono uppercase">{email}</p>
          </div>
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-neutral-900 flex items-center justify-center border border-white/10 shadow-lg group cursor-pointer hover:border-blue-500/50 hover:bg-blue-600/5 transition-all duration-300 shrink-0 overflow-hidden">
            {photoURL ? (
              <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <CircleUser className="w-5 h-5 text-neutral-400 group-hover:text-blue-400 transition-colors" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

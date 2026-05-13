import { Search, Command, CircleUser, Menu, Inbox, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, userProfile } = useAuth();
  const { t } = useTranslation();

  const displayName = userProfile?.displayName || user?.displayName || 'Entidad desconocida';
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const email = userProfile?.email || user?.email;

  return (
    <header className="sticky top-0 z-30 w-full px-4 pt-4 md:px-6 xl:px-8">
      <div className="shell-panel flex h-18 items-center justify-between gap-4 px-4 py-3 md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
          <button
            onClick={onMenuClick}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-2.5 text-neutral-500 transition-colors hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden min-w-0 sm:block">
            <p className="section-kicker mb-1 !tracking-[0.22em] text-neutral-400">Consola operativa</p>
            <p className="truncate text-sm font-semibold text-white">Coordinación operativa asistida por IA</p>
          </div>

          <div className="relative hidden max-w-xl flex-1 sm:block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            <input
              type="text"
              placeholder={t('common.search')}
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-11 pr-24 text-sm text-white placeholder:text-neutral-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/25 focus:border-blue-400/30"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-xl border border-white/8 bg-white/[0.03] px-2 py-1">
              <Command className="h-3 w-3 text-neutral-500" />
              <span className="font-mono text-[10px] text-neutral-500">K</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden items-center gap-2 rounded-2xl border border-emerald-400/10 bg-emerald-400/5 px-3 py-2 md:flex">
            <span className="status-dot pulse-live bg-emerald-400 text-emerald-400" />
            <div className="leading-tight">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">Sincronización en vivo</p>
              <p className="font-mono text-[10px] text-neutral-500">Vigilancia IA activa</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-2xl border border-blue-400/10 bg-blue-400/5 px-3 py-2 lg:flex">
            <Sparkles className="h-4 w-4 text-blue-300" />
            <div className="leading-tight">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">Capa IA</p>
              <p className="font-mono text-[10px] text-neutral-500">Operador listo</p>
            </div>
          </div>

          <LanguageSwitcher />

          <button className="relative hidden rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-neutral-500 transition-colors hover:text-white md:block">
            <Inbox className="h-4.5 w-4.5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_14px_rgba(96,165,250,0.7)]" />
          </button>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-2.5 py-2 pr-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-semibold text-white">{displayName}</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{email}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <CircleUser className="h-5 w-5 text-neutral-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

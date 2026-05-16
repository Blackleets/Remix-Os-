import { useNavigate } from 'react-router-dom';
import { Zap, X, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export function TrialBanner() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const subscription = company?.subscription;
  if (!subscription || subscription.status !== 'trialing' || dismissed) return null;

  const trialEndsAt = subscription.trialEndsAt;
  if (!trialEndsAt) return null;

  const endDate: Date = trialEndsAt?.toDate ? trialEndsAt.toDate() : new Date(trialEndsAt);
  const now = new Date();
  const msLeft = endDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return null;

  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7;
  const tone = isUrgent
    ? 'border-red-400/18 bg-red-400/8 text-red-200'
    : isWarning
      ? 'border-amber-400/18 bg-amber-400/8 text-amber-200'
      : 'border-blue-400/18 bg-blue-400/8 text-blue-200';

  const daysLabel = daysLeft === 0 ? 'hoy' : daysLeft === 1 ? '1 día' : `${daysLeft} días`;

  return (
    <div className="px-4 pt-3 md:px-6 xl:px-8">
      <div className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 backdrop-blur-sm ${tone}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="min-w-0 truncate text-xs font-bold">
            Trial · {daysLabel}
          </span>
          <span className="hidden sm:inline text-xs opacity-60">
            {isUrgent ? '— ¡Últimas horas!' : isWarning ? '— Pronto termina' : '— Plan gratuito activo'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => navigate('/billing')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-current/18 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-current transition-colors hover:bg-black/28"
          >
            <Zap className="h-3 w-3" />
            <span>Ver planes</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg border border-current/10 bg-black/10 p-1.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

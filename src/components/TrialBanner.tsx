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

  return (
    <div className="px-4 pt-4 md:px-6 xl:px-8">
      <div className={`shell-panel flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${tone}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-current/15 bg-black/15">
            <Clock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-current/80">Trial activo</p>
            <p className="truncate text-sm font-semibold text-current">
              {daysLeft === 0
                ? 'Tu trial gratuito vence hoy'
                : daysLeft === 1
                  ? 'Queda 1 dia de trial'
                  : `Quedan ${daysLeft} dias de trial`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => navigate('/billing')}
            className="inline-flex items-center gap-2 rounded-2xl border border-current/18 bg-black/20 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-current transition-colors hover:bg-black/28"
          >
            <Zap className="h-3 w-3" />
            Ver planes
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-xl border border-current/10 bg-black/10 p-2 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

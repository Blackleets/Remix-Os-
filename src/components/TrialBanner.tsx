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

  // Already expired — gate handled by ProtectedRoute, don't show banner
  if (daysLeft < 0) return null;

  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7;

  return (
    <div
      className={`
        w-full px-4 py-2.5 flex items-center justify-between gap-4 text-sm
        border-b transition-colors
        ${isUrgent
          ? 'bg-red-500/10 border-red-500/20 text-red-300'
          : isWarning
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          : 'bg-blue-600/10 border-blue-500/20 text-blue-300'
        }
      `}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium text-xs truncate">
          {daysLeft === 0
            ? 'Your free trial expires today'
            : daysLeft === 1
            ? '1 day left in your free trial'
            : `${daysLeft} days left in your free trial`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate('/billing')}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all
            ${isUrgent
              ? 'bg-red-500 text-white hover:bg-red-400'
              : isWarning
              ? 'bg-amber-500 text-black hover:bg-amber-400'
              : 'bg-blue-600 text-white hover:bg-blue-500'
            }
          `}
        >
          <Zap className="w-3 h-3" />
          Upgrade
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

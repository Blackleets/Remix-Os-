import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BetaFeedbackModal } from './BetaFeedbackModal';
import { Button } from './Common';

export function BetaFeedbackButton() {
  const { user, company } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (!user || !company || pathname === '/pos') return null;

  return (
    <>
      <div className="fixed bottom-5 left-4 z-[45] md:bottom-6 md:left-6 xl:left-8">
        <Button
          variant="secondary"
          className="gap-2 border-white/12 bg-black/45 px-4 py-3 text-sm text-white shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl hover:border-blue-400/25 hover:bg-blue-500/10"
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Feedback Beta
        </Button>
      </div>
      <BetaFeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

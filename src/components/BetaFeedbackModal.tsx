import { Bug, BrainCircuit, CreditCard, Lightbulb, MonitorCog, Send, TriangleAlert, WandSparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  type BetaFeedbackSeverity,
  type BetaFeedbackType,
  submitBetaFeedback,
} from '../services/feedbackService';
import { Button, Input, Label, OSGlyph, cn } from './Common';

const FEEDBACK_TYPES: Array<{
  value: BetaFeedbackType;
  label: string;
  description: string;
  icon: typeof Bug;
}> = [
  { value: 'bug', label: 'Bug', description: 'Algo se rompió o se comporta mal.', icon: Bug },
  { value: 'idea', label: 'Idea', description: 'Nueva capacidad o flujo que vale la pena construir.', icon: Lightbulb },
  { value: 'ux', label: 'UX', description: 'Fricción, confusión o pasos de más en la experiencia.', icon: MonitorCog },
  { value: 'billing', label: 'Billing', description: 'Problemas o dudas en planes, cobros o trial.', icon: CreditCard },
  { value: 'copilot', label: 'Copilot', description: 'Respuesta mala, contexto faltante o fallo de IA.', icon: BrainCircuit },
  { value: 'other', label: 'Otro', description: 'Cualquier otra señal útil para estabilizar la beta.', icon: WandSparkles },
];

const SEVERITIES: Array<{
  value: BetaFeedbackSeverity;
  label: string;
  tone: 'neutral' | 'blue' | 'amber' | 'red';
}> = [
  { value: 'low', label: 'Low', tone: 'neutral' },
  { value: 'medium', label: 'Medium', tone: 'blue' },
  { value: 'high', label: 'High', tone: 'amber' },
  { value: 'critical', label: 'Critical', tone: 'red' },
];

export function BetaFeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, userProfile, company } = useAuth();
  const location = useLocation();
  const [type, setType] = useState<BetaFeedbackType>('bug');
  const [severity, setSeverity] = useState<BetaFeedbackSeverity>('medium');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackState, setFeedbackState] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (!open) return null;

  const resetState = () => {
    setType('bug');
    setSeverity('medium');
    setTitle('');
    setMessage('');
    setFeedbackState(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    if (!user || !company) return;
    setSubmitting(true);
    setFeedbackState(null);

    try {
      await submitBetaFeedback({
        companyId: company.id,
        companyName: company.name,
        userId: user.uid,
        userEmail: userProfile?.email || user.email || '',
        userName: userProfile?.displayName || user.displayName || '',
        type,
        severity,
        title,
        message,
        pagePath: location.pathname,
      });

      setFeedbackState({
        tone: 'success',
        text: 'Feedback recibido. Gracias por ayudar a mejorar Remix OS.',
      });
      setTitle('');
      setMessage('');
      setType('bug');
      setSeverity('medium');
    } catch (error) {
      console.error('Failed to submit beta feedback:', error);
      setFeedbackState({
        tone: 'error',
        text: 'No pudimos enviar tu feedback. Inténtalo de nuevo.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/72 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm">
      <div className="absolute inset-0" onClick={handleClose} />
      <div className="relative z-10 max-h-[calc(100dvh-3rem)] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-neutral-950 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
        <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker text-blue-300">Feedback Beta</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Feedback Beta</h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                Reporta errores, fricción o ideas directamente al equipo de Remix OS.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-neutral-500 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <div>
                <Label>Tipo</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {FEEDBACK_TYPES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setType(item.value)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-all',
                        type === item.value
                          ? 'border-blue-400/30 bg-blue-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <OSGlyph tone={type === item.value ? 'blue' : 'neutral'} size="sm">
                          <item.icon className="h-4 w-4" />
                        </OSGlyph>
                        <div>
                          <p className="text-sm font-semibold text-white">{item.label}</p>
                          <p className="mt-1 text-xs text-neutral-500">{item.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Severidad</Label>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  {SEVERITIES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSeverity(item.value)}
                      className={cn(
                        'rounded-2xl border px-3 py-3 text-sm font-semibold transition-all',
                        severity === item.value
                          ? 'border-white/16 bg-white/[0.09] text-white'
                          : 'border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white'
                      )}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <OSGlyph tone={item.tone} size="sm">
                          <TriangleAlert className="h-4 w-4" />
                        </OSGlyph>
                        {item.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="Resumen corto del problema o idea"
                />
                <p className="mt-2 text-right text-[11px] text-neutral-500">{title.length}/120</p>
              </div>

              <div>
                <Label>Mensaje</Label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={3000}
                  placeholder="Describe el contexto, qué pasó y qué esperabas que ocurriera."
                  className="min-h-[220px] w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-all duration-200 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/24"
                />
                <p className="mt-2 text-right text-[11px] text-neutral-500">{message.length}/3000</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-xs text-neutral-400">
                <p className="font-semibold text-white">Ruta actual</p>
                <p className="mt-1 font-mono">{location.pathname}</p>
                <p className="mt-3 font-semibold text-white">Empresa activa</p>
                <p className="mt-1">{company?.name || 'Sin empresa activa'}</p>
              </div>
            </div>
          </div>

          {feedbackState ? (
            <div
              className={cn(
                'rounded-2xl border px-4 py-3 text-sm',
                feedbackState.tone === 'success'
                  ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200'
                  : 'border-red-500/20 bg-red-500/[0.08] text-red-200'
              )}
            >
              {feedbackState.text}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              El feedback se guarda con tu usuario, tu empresa activa y la pantalla actual.
            </p>
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cerrar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !message.trim() || !user || !company}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Enviando…' : 'Enviar feedback'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

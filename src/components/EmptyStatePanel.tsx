import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Button, OSGlyph, cn } from './Common';

type Tone = 'blue' | 'emerald' | 'amber' | 'neutral';

interface EmptyStatePanelProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

// Premium empty state for SaaS admin pages (Orders / Products / Customers / Inventory).
// Designed to feel like Shopify-tier clarity but inside Remix OS dark/brutalist shell —
// big icon, short title, helpful sentence, primary CTA, discreet secondary link.
export function EmptyStatePanel({
  eyebrow,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  primaryDisabled,
  secondaryActionLabel,
  onSecondaryAction,
  icon,
  tone = 'blue',
  className,
}: EmptyStatePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[28px] border border-white/10',
        'bg-[linear-gradient(180deg,rgba(15,18,26,0.94),rgba(7,10,16,0.96))]',
        'px-6 py-12 text-center shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:px-12 sm:py-16',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(91,136,255,0.14),transparent_72%)]" />

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 -m-2 rounded-[28px] bg-blue-500/10 blur-2xl" aria-hidden />
          <OSGlyph tone={tone} size="lg" className="relative !h-16 !w-16 !rounded-[22px]">
            {icon}
          </OSGlyph>
        </div>

        {eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">{eyebrow}</p>
        )}

        <div className="max-w-md space-y-3">
          <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h3>
          <p className="text-sm leading-relaxed text-neutral-400 sm:text-base">{description}</p>
        </div>

        {(primaryActionLabel || secondaryActionLabel) && (
          <div className="mt-2 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            {primaryActionLabel && onPrimaryAction && (
              <Button
                onClick={onPrimaryAction}
                disabled={primaryDisabled}
                className="h-12 w-full gap-2 px-7 sm:w-auto"
              >
                {primaryActionLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {secondaryActionLabel && onSecondaryAction && (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="text-sm font-semibold text-neutral-400 underline-offset-4 transition-colors hover:text-blue-200 hover:underline"
              >
                {secondaryActionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

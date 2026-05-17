import { useId, type SVGProps } from 'react';

type RemixLogoProps = SVGProps<SVGSVGElement> & {
  showWordmark?: boolean;
  compact?: boolean;
  mobileIconOnly?: boolean;
};

export function RemixLogo({
  showWordmark = true,
  compact = false,
  mobileIconOnly = false,
  className,
  ...props
}: RemixLogoProps) {
  const id = useId().replace(/:/g, '');
  const markId = `${id}-remix-os-mark`;
  const shadowId = `${id}-remix-os-shadow`;
  const glowId = `${id}-remix-os-glow`;

  return (
    <div className={`inline-flex min-w-0 items-center gap-3 ${className || ''}`}>
      <svg
        width={compact ? 36 : 48}
        height={compact ? 36 : 48}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Remix OS logo"
        {...props}
      >
        <defs>
          <linearGradient id={markId} x1="12" y1="56" x2="57" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C026D3" />
            <stop offset="22%" stopColor="#2563EB" />
            <stop offset="55%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#D9F99D" />
          </linearGradient>

          <linearGradient id={shadowId} x1="15" y1="48" x2="51" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#07111F" stopOpacity="0.56" />
            <stop offset="55%" stopColor="#020617" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </linearGradient>

          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.05
                      0 0 0 0 0.55
                      0 0 0 0 1
                      0 0 0 0.45 0"
            />
            <feBlend in="SourceGraphic" mode="screen" />
          </filter>
        </defs>

        <g filter={`url(#${glowId})`}>
          <path
            d="M17.2 9H47.8C52.2 9 55.8 12.6 55.8 17V22.7C55.8 25.4 54.4 27.9 52.2 29.4L41.5 36.5L54.2 49.4C56.2 51.4 54.8 55 51.9 55H36.4C34.5 55 32.7 54.2 31.4 52.8L22.1 43.1L17.2 48.3C14 51.8 8.2 49.5 8.2 44.8V18C8.2 13 12.2 9 17.2 9Z"
            fill={`url(#${markId})`}
          />
          <path
            d="M17.2 9H47.8C52.2 9 55.8 12.6 55.8 17V22.7C55.8 25.4 54.4 27.9 52.2 29.4L41.5 36.5L54.2 49.4C56.2 51.4 54.8 55 51.9 55H36.4C34.5 55 32.7 54.2 31.4 52.8L22.1 43.1L17.2 48.3C14 51.8 8.2 49.5 8.2 44.8V18C8.2 13 12.2 9 17.2 9Z"
            fill={`url(#${shadowId})`}
          />
          <path
            d="M15.8 9.8L33.3 27.5H11.1V18C11.1 13.5 14.4 9.9 18.7 9.8H15.8Z"
            fill="#0B1220"
            opacity="0.18"
          />
          <path
            d="M52.3 10.4L29.3 34H15L40.7 9H48C49.5 9 50.9 9.5 52.3 10.4Z"
            fill="#EAFBFF"
            opacity="0.22"
          />
          <path
            d="M13.3 45.7L25.8 31.5H17.8L50.7 10.9L35.8 28.8H47.5L13.3 45.7Z"
            fill="#06111F"
            opacity="0.76"
          />
          <path
            d="M21.1 47.8L31.7 36.6L45.6 51.4H37C35.3 51.4 33.7 50.7 32.5 49.5L24.9 41.5L21.1 47.8Z"
            fill="#023B8F"
            opacity="0.26"
          />
          <path
            d="M17.2 9.5H47.8C51.9 9.5 55.3 12.9 55.3 17V22.7C55.3 25.2 54 27.6 51.9 29L40.7 36.4L53.8 49.8C55.5 51.5 54.3 54.5 51.9 54.5H36.4C34.6 54.5 33 53.8 31.8 52.5L22.1 42.4L16.9 47.9C14.1 51 8.7 49 8.7 44.8V18C8.7 13.3 12.5 9.5 17.2 9.5Z"
            stroke="white"
            strokeOpacity="0.2"
          />
        </g>
      </svg>

      {showWordmark && (
        <div className={`min-w-0 leading-none ${mobileIconOnly ? 'hidden sm:block' : ''}`}>
          <div className="truncate text-[15px] font-black uppercase tracking-[0.22em] text-white">
            Remix <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">OS</span>
          </div>
          {!compact && (
            <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-white/38">
              AI Business Operating System
            </div>
          )}
        </div>
      )}
    </div>
  );
}

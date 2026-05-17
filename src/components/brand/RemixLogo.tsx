import type { SVGProps } from 'react';

type RemixLogoProps = SVGProps<SVGSVGElement> & {
  showWordmark?: boolean;
  compact?: boolean;
};

export function RemixLogo({
  showWordmark = true,
  compact = false,
  className,
  ...props
}: RemixLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className || ''}`}>
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
          <linearGradient id="remix-os-bg" x1="8" y1="56" x2="58" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="35%" stopColor="#2563EB" />
            <stop offset="65%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#A3E635" />
          </linearGradient>

          <linearGradient id="remix-os-bolt" x1="20" y1="48" x2="48" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#05070A" />
            <stop offset="55%" stopColor="#07111F" />
            <stop offset="100%" stopColor="#0B1220" />
          </linearGradient>

          <filter id="remix-os-glow" x="-30%" y="-30%" width="160%" height="160%">
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

        <rect
          x="7"
          y="7"
          width="50"
          height="50"
          rx="14"
          fill="url(#remix-os-bg)"
          filter="url(#remix-os-glow)"
        />

        <path
          d="M18 43.5L31.2 30.8H20.7L45.7 14.8L34.2 28.9H45.8L18 43.5Z"
          fill="url(#remix-os-bolt)"
          opacity="0.96"
        />

        <path
          d="M22.2 14.5H44.2C49.5 14.5 53.5 18.5 53.5 23.8V40.2C53.5 45.5 49.5 49.5 44.2 49.5H20.8L31.9 39.8H41.5C43.4 39.8 44.9 38.3 44.9 36.4V27.8C44.9 25.9 43.4 24.4 41.5 24.4H31.4L22.2 14.5Z"
          fill="white"
          opacity="0.12"
        />

        <rect
          x="7.5"
          y="7.5"
          width="49"
          height="49"
          rx="13.5"
          stroke="white"
          strokeOpacity="0.22"
        />
      </svg>

      {showWordmark && (
        <div className="leading-none">
          <div className="text-[15px] font-black uppercase tracking-[0.22em] text-white">
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

'use client'

import { cn } from '@/lib/utils'

/*
 * LoadingAnimation — branded loading spinner for Midman.
 *
 * Uses the site's parrot-green (#84CC16 / oklch 0.768 0.189 131) as the
 * accent colour so it feels native on every page.
 *
 * Sizes:
 *   sm  → inline / button-level (24×24)
 *   md  → section-level (48×48)
 *   lg  → page-level  (80×80)
 */

export type LoadingSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<LoadingSize, { box: string; text: string; bar: string; barH: number; radius: number }> = {
  sm: { box: 'h-6 w-6', text: 'text-[3px]', bar: 'h-[1.5px]', barH: 1.5, radius: 7 },
  md: { box: 'h-12 w-12', text: 'text-[5px]', bar: 'h-[2.5px]', barH: 2.5, radius: 14 },
  lg: { box: 'h-20 w-20', text: 'text-[8px]', bar: 'h-[4px]', barH: 4, radius: 24 },
}

export function LoadingAnimation({
  size = 'md',
  className,
  label,
}: {
  size?: LoadingSize
  className?: string
  /** Optional text shown below the animation */
  label?: string
}) {
  const s = sizeMap[size]
  const r = s.radius
  const barH = s.barH
  const pad = size === 'sm' ? 1.5 : size === 'md' ? 3 : 5
  const innerW = 2 * r - 2 * pad

  /* Keyframe-style values for the sliding indicator */
  const barW = innerW * 0.55
  const travel = innerW - barW
  const sx = pad

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <svg
        viewBox={`0 0 ${2 * r} ${2 * r}`}
        className={cn(s.box, 'shrink-0')}
        aria-hidden="true"
      >
        <defs>
          {/* Gradient for the sliding bar — uses CSS currentColor so Tailwind can control it */}
          <linearGradient id={`lg-fill-${size}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-primary, #84CC16)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--color-primary, #84CC16)" stopOpacity="1" />
          </linearGradient>

          {/* Clip-path for the bar track */}
          <clipPath id={`lg-track-${size}`}>
            <rect
              x={pad}
              y={r - barH / 2}
              width={innerW}
              height={barH}
              rx={barH / 2}
            />
          </clipPath>
        </defs>

        {/* Outer circle — subtle ring */}
        <circle
          cx={r}
          cy={r}
          r={r - 0.5}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.6}
          className="text-muted-foreground/20"
        />

        {/* "LOADING" text — only visible at md and lg */}
        {(size === 'md' || size === 'lg') && (
          <text
            x={r}
            y={r - barH - 1}
            textAnchor="middle"
            className={cn(s.text, 'font-bold fill-foreground/70 select-none')}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            LOADING
          </text>
        )}

        {/* Track background */}
        <rect
          x={pad}
          y={r - barH / 2}
          width={innerW}
          height={barH}
          rx={barH / 2}
          className="fill-muted"
        />

        {/* Sliding indicator */}
        <g clipPath={`url(#lg-track-${size})`}>
          <rect
            x={sx}
            y={r - barH / 2}
            width={barW}
            height={barH}
            rx={barH / 2}
            fill={`url(#lg-fill-${size})`}
          >
            <animate
              attributeName="x"
              values={`${sx};${sx + travel * 0.8};${sx}`}
              dur="1.6s"
              repeatCount="indefinite"
              keyTimes="0;0.5;1"
              keySplines="0.45 0 0.15 1;0.45 0 0.15 1"
              calcMode="spline"
            />
            <animate
              attributeName="width"
              values={`${barW};${barW * 0.5};${barW}`}
              dur="1.6s"
              repeatCount="indefinite"
              keyTimes="0;0.5;1"
              keySplines="0.45 0 0.15 1;0.45 0 0.15 1"
              calcMode="spline"
            />
          </rect>
        </g>

        {/* Small pulse dots at track ends */}
        <circle cx={pad} cy={r} r={barH * 0.8} className="fill-primary/30">
          <animate
            attributeName="opacity"
            values="0.3;0.8;0.3"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
        <circle
          cx={pad + innerW}
          cy={r}
          r={barH * 0.8}
          className="fill-primary/30"
        >
          <animate
            attributeName="opacity"
            values="0.8;0.3;0.8"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {label && (
        <p className="text-xs text-muted-foreground animate-pulse">{label}</p>
      )}
    </div>
  )
}

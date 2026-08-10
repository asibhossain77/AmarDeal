'use client'

import { cn } from '@/lib/utils'

/*
 * LoadingAnimation — branded loading spinner for Midman.
 *
 * Modern spinning gradient arc with glow effect.
 * Uses the site's parrot-green (#84CC16) as the accent colour.
 *
 * Sizes:
 *   sm  → inline / button-level (24×24)
 *   md  → section-level (48×48)
 *   lg  → page-level  (80×80)
 */

export type LoadingSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<LoadingSize, { box: string; r: number; stroke: number; glow: number }> = {
  sm: { box: 'h-6 w-6', r: 10, stroke: 2.2, glow: 1.5 },
  md: { box: 'h-12 w-12', r: 20, stroke: 3.5, glow: 2.5 },
  lg: { box: 'h-20 w-20', r: 34, stroke: 4.5, glow: 3.5 },
}

export function LoadingAnimation({
  size = 'md',
  className,
  label,
}: {
  size?: LoadingSize
  className?: string
  label?: string
}) {
  const { box, r, stroke, glow } = sizeMap[size]
  const d = r * 2 + glow * 4 // viewBox with room for glow
  const c = d / 2 // center

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <svg
        viewBox={`0 0 ${d} ${d}`}
        className={cn(box, 'shrink-0')}
        aria-hidden="true"
      >
        <defs>
          {/* Gradient for the spinning arc */}
          <linearGradient id={`la-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary, #84CC16)" />
            <stop offset="100%" stopColor="#a3e635" />
          </linearGradient>

          {/* Soft glow filter */}
          <filter id={`la-glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={glow} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track ring — subtle background circle */}
        <circle
          cx={c} cy={c} r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke * 0.35}
          className="text-muted-foreground/15"
        />

        {/* Spinning arc — the main animated element */}
        <circle
          cx={c} cy={c} r={r}
          fill="none"
          stroke={`url(#la-grad-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${r * 1.4} ${r * 4.8}`}
          filter={`url(#la-glow-${size})`}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${c} ${c}`}
            to={`360 ${c} ${c}`}
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Second arc — thinner, counter-rotating for depth */}
        <circle
          cx={c} cy={c} r={r * 0.65}
          fill="none"
          stroke="var(--color-primary, #84CC16)"
          strokeWidth={stroke * 0.4}
          strokeLinecap="round"
          strokeDasharray={`${r * 0.6} ${r * 3.4}`}
          opacity="0.3"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`360 ${c} ${c}`}
            to={`0 ${c} ${c}`}
            dur="1.8s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Center pulse dot */}
        <circle
          cx={c} cy={c} r={stroke * 0.7}
          fill="var(--color-primary, #84CC16)"
          opacity="0.6"
        >
          <animate
            attributeName="r"
            values={`${stroke * 0.5};${stroke * 0.9};${stroke * 0.5}`}
            dur="1.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.4;0.8;0.4"
            dur="1.2s"
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

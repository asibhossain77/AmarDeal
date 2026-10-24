'use client';

/**
 * HeroIllustration — lightweight, theme-aware inline SVG for the Midman hero.
 *
 * Design: a friendly person working on a laptop behind a desk, surrounded by
 * soft floating chips (security shield, storefront, buyers/sellers, verified
 * badge) plus a small analytics card — mirroring the four hero action cards'
 * coordinated accents (green / mint / purple / orange).
 *
 * Deliberately hand-built inline SVG (no illustration dependency, ~10KB):
 *  - Theme-aware via Tailwind `dark:` classes on fills/strokes (same mechanism
 *    as the rest of the site — no duplicated theme logic, no JS switching).
 *  - Fixed viewBox + w-full → intrinsic ratio, zero layout shift.
 *  - Chips float with a slow framer-motion loop, fully disabled when the user
 *    prefers reduced motion.
 */

import { motion, useReducedMotion } from 'framer-motion';

/* Skin / hair / neutral tones shared across themes */
const SKIN = '#F0BE96';
const HAIR = '#2C3831';

/* One floating chip: white rounded card + accent icon (pops on the mint blob) */
function FloatChip({
  x,
  y,
  delay,
  borderLight,
  borderDark,
  strokeLight,
  strokeDark,
  animate,
  children,
}: {
  x: number;
  y: number;
  delay: number;
  borderLight: string;
  borderDark: string;
  strokeLight: string;
  strokeDark: string;
  animate: { y: number[] } | undefined;
  children: React.ReactNode;
}) {
  return (
    <motion.g
      animate={animate}
      transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {/* translate(x,y) places the whole chip (bg + icon paths drawn in 0..64 local coords) */}
      <g transform={`translate(${x} ${y})`}>
        <rect width="64" height="64" rx="17" strokeWidth="1.5" className={`fill-white ${borderLight} dark:fill-[#232B23] ${borderDark}`} />
        <g
          fill="none"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={strokeLight}
        >
          <g className={`${strokeDark} hidden dark:block`}>{children}</g>
          <g className="dark:hidden">{children}</g>
        </g>
      </g>
    </motion.g>
  );
}

export function HeroIllustration() {
  const reduce = useReducedMotion();
  const float = reduce ? undefined : { y: [0, -8, 0] };

  return (
    <svg
      viewBox="0 0 560 480"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className="h-auto w-full select-none"
    >
      {/* ── Soft mint blob backdrop ── */}
      <path
        d="M280 58 C392 54 468 128 474 236 C480 340 396 424 282 428 C168 432 92 356 88 250 C84 148 168 62 280 58 Z"
        className="fill-[#DDF7EC] dark:fill-[#141D16]"
      />

      {/* ── Decorative shapes ── */}
      <g aria-hidden>
        {/* dot grid (top-left) */}
        {[40, 66, 92].map((cx) =>
          [30, 56, 82].map((cy) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="3"
              className="fill-[#9AD1B4] opacity-70 dark:fill-[#2E4A3B]"
            />
          ))
        )}
        {/* brand ring (top-right) */}
        <circle
          cx="512"
          cy="88"
          r="24"
          fill="none"
          strokeWidth="8"
          className="stroke-primary opacity-20"
        />
        {/* small accents */}
        <circle cx="56" cy="404" r="7" className="fill-primary opacity-25" />
        <circle cx="182" cy="120" r="5" className="fill-[#8FD8AE] opacity-70 dark:fill-[#2E4A3B]" />
        <path
          d="M480 422 v12 M474 428 h12"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-[#B8CFC0] dark:stroke-[#2A322B]"
        />
      </g>

      {/* ── Ground shadow ── */}
      <ellipse
        cx="280"
        cy="445"
        rx="170"
        ry="13"
        className="fill-[#16402B] opacity-[0.08] dark:fill-black dark:opacity-25"
      />

      {/* ── Person (behind desk) ── */}
      <g aria-hidden>
        {/* torso */}
        <rect x="234" y="246" width="92" height="112" rx="38" className="fill-primary" />
        {/* neck + head */}
        <rect x="271" y="230" width="18" height="20" rx="7" fill={SKIN} />
        <circle cx="280" cy="206" r="33" fill={SKIN} />
        {/* hair */}
        <path d="M249 196 a31 31 0 0 1 62 0 Z" fill={HAIR} />
        {/* arms reaching to the laptop */}
        <path
          d="M252 286 C238 300 238 324 256 334 M308 286 C322 300 322 324 344 334"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          stroke="#65A30D"
        />
      </g>

      {/* ── Desk ── */}
      <rect
        x="130"
        y="342"
        width="300"
        height="100"
        rx="18"
        strokeWidth="1.5"
        className="fill-white stroke-[#E4EEE8] dark:fill-[#1F261F] dark:stroke-[#2A322B]"
      />

      {/* ── Laptop (lid toward viewer, brand mark) ── */}
      <g aria-hidden>
        <rect
          x="245"
          y="266"
          width="110"
          height="70"
          rx="10"
          strokeWidth="1.5"
          className="fill-white stroke-[#E4EEE8] dark:fill-[#222922] dark:stroke-[#2A322B]"
        />
        <circle cx="300" cy="299" r="12.5" className="fill-primary" />
        <path
          d="M294.5 299 L299 303.5 L306.5 294.5"
          fill="none"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-white"
        />
        <rect x="230" y="334" width="140" height="9" rx="4.5" className="fill-[#D7E2D8] dark:fill-[#39443B]" />
        {/* hands resting on the laptop base */}
        <circle cx="256" cy="338" r="7.5" fill={SKIN} />
        <circle cx="344" cy="338" r="7.5" fill={SKIN} />
      </g>

      {/* ── Analytics mini card ── */}
      <motion.g animate={float} transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}>
        <rect
          x="380"
          y="300"
          width="112"
          height="78"
          rx="16"
          strokeWidth="1.5"
          className="fill-white stroke-[#E4EEE8] dark:fill-[#1F261F] dark:stroke-[#2A322B]"
        />
        <circle cx="394" cy="316" r="3" className="fill-[#BBE7C8] dark:fill-[#2F4A38]" />
        <rect x="402" y="313" width="52" height="5.5" rx="2.75" className="fill-[#EAF3EC] dark:fill-[#2A322B]" />
        <rect x="392" y="348" width="11" height="14" rx="3" className="fill-[#D5F2E0] dark:fill-[#274233]" />
        <rect x="407" y="340" width="11" height="22" rx="3" className="fill-[#A8E6C4] dark:fill-[#2E5440]" />
        <rect x="422" y="332" width="11" height="30" rx="3" className="fill-[#7BD7A6] dark:fill-[#376B50]" />
        <rect x="437" y="322" width="11" height="40" rx="3" className="fill-primary" />
        <path
          d="M388 364 H472"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-[#E4EEE8] dark:stroke-[#2A322B]"
        />
      </motion.g>

      {/* ── Floating chips (echo the four action cards) ── */}
      {/* Security — brand green */}
      <FloatChip x={106} y={90} delay={0} borderLight="stroke-[#BFE3A8]" borderDark="stroke-[#3A4A22]" strokeLight="stroke-[#4D7C0F]" strokeDark="stroke-[#BEF264]" animate={float}>
        <path d="M32 19 L41.5 23 V30.5 C41.5 37.5 37.5 41.8 32 43.8 C26.5 41.8 22.5 37.5 22.5 30.5 V23 Z" />
        <path d="M27.5 31.5 L30.8 34.8 L36.8 28.5" />
      </FloatChip>

      {/* Marketplace — mint */}
      <FloatChip x={400} y={62} delay={1.2} borderLight="stroke-[#A8E0CC]" borderDark="stroke-[#1E3D33]" strokeLight="stroke-[#0D9276]" strokeDark="stroke-[#5EEAD4]" animate={float}>
        <path d="M20.5 26.5 H43.5 L41.5 20 H22.5 Z" />
        <path d="M24 26.5 V43.5 H40 V26.5" />
        <path d="M29.5 43.5 V34.5 H34.5 V43.5" />
      </FloatChip>

      {/* Buyers & sellers — soft purple */}
      <FloatChip x={446} y={196} delay={2.1} borderLight="stroke-[#DDD0FA]" borderDark="stroke-[#393452]" strokeLight="stroke-[#7C3AED]" strokeDark="stroke-[#C4B5FD]" animate={float}>
        <circle cx="28.5" cy="27.5" r="4.5" />
        <path d="M21.5 42 C21.5 36.5 24.5 34 28.5 34 C32.5 34 35.5 36.5 35.5 42" />
        <circle cx="38.5" cy="26.5" r="3.8" />
        <path d="M41.5 33.5 C44 34.5 45.8 37 45.8 40.5" />
      </FloatChip>

      {/* Verified business — soft orange */}
      <FloatChip x={70} y={224} delay={3} borderLight="stroke-[#F8D6B0]" borderDark="stroke-[#4A3A22]" strokeLight="stroke-[#EA580C]" strokeDark="stroke-[#FDBA74]" animate={float}>
        <circle cx="32" cy="31.5" r="11" />
        <path d="M27.5 31.5 L30.7 34.7 L36.5 28.7" />
      </FloatChip>
    </svg>
  );
}

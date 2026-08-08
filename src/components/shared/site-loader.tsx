'use client';

import { useEffect, useState } from 'react';

export function SiteLoader() {
  const [show, setShow] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
      setTimeout(() => setShow(false), 400);
    }, 500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-400 ${exiting ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Logo — static fallback to avoid hydration mismatch */}
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 animate-[logo-pulse_2s_ease-in-out_infinite]">
        <span className="text-sm font-bold text-primary">M</span>
      </div>

      {/* Site Name */}
      <p className="mt-3 text-sm font-bold tracking-tight text-foreground animate-[fade-up_0.4s_ease-out_0.2s_both]">
        মিডম্যান
      </p>

      {/* Loading dots */}
      <div className="mt-2.5 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary animate-[dot-bounce_0.8s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      {/* Inline keyframes — no Framer Motion needed */}
      <style>{`
        @keyframes logo-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        @keyframes fade-up {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes dot-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

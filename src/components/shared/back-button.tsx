'use client';

import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface BackButtonProps {
  /** Override label text */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Variant: 'ghost' (subtle icon) or 'outline' (bordered with text) */
  variant?: 'ghost' | 'outline';
}

export function BackButton({ label = 'ফিরে যান', className = '', variant = 'outline' }: BackButtonProps) {
  const goBack = useAppStore((s) => s.goBack);
  const view = useAppStore((s) => s.view);
  const _prevView = useAppStore((s) => s._prevView);
  const _prevDashPanel = useAppStore((s) => s._prevDashPanel);
  const _prevSellerPanel = useAppStore((s) => s._prevSellerPanel);

  // Determine if back is available
  const isBackToPublicView = _prevView === 'landing' || _prevView === 'auth';
  const canGoBack =
    (view === 'dashboard' && _prevDashPanel) ||
    (view === 'seller' && _prevSellerPanel) ||
    (Boolean(_prevView) && !isBackToPublicView);

  if (!canGoBack) return null;

  if (variant === 'ghost') {
    return (
      <button
        onClick={goBack}
        className={`inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className}`}
        aria-label={label}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={goBack}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent ${className}`}
      aria-label={label}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
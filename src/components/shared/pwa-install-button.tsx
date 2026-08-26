'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check if user previously dismissed
    if (localStorage.getItem('pwa-dismissed')) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if SW is registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    } else {
      setDismissed(true);
      localStorage.setItem('pwa-dismissed', '1');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-dismissed', '1');
  };

  // Don't show if: no prompt available, already dismissed, or installed as PWA
  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-white dark:bg-zinc-900 p-3 shadow-lg">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground leading-tight">
            অ্যাপ ইনস্টল করুন
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleInstall}
          className="shrink-0 rounded-xl"
        >
          ইনস্টল
        </Button>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="বন্ধ করুন"
        >
          ×
        </button>
      </div>
    </div>
  );
}

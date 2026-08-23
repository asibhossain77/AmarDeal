'use client';

import { useT } from '@/lib/i18n';
import { Home } from 'lucide-react';

export default function NotFound() {
  const t = useT();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center !bg-[#F2F4F7] px-4 dark:!bg-[#09090b]">
      <div className="text-center">
        {/* Large 404 with glow */}
        <div className="relative inline-block">
          <p className="text-8xl font-black tracking-tighter text-primary sm:text-9xl">
            404
          </p>
          <div className="absolute inset-0 -z-10 blur-3xl opacity-20 bg-primary" />
        </div>

        {/* Title */}
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          {t('notFound.title')}
        </h1>

        {/* Description */}
        <p className="mt-3 max-w-md text-base text-muted-foreground">
          {t('notFound.description')}
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => { window.location.href = '/'; }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]"
          >
            <Home className="h-4 w-4" />
            {t('notFound.backHome')}
          </button>
        </div>

      </div>
    </div>
  );
}

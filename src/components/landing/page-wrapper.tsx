'use client';

import { ReactNode, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { Footer } from './footer';

interface PageWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function PageWrapper({ children, title, subtitle }: PageWrapperProps) {
  const setView = useAppStore((s) => s.setView);
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      {/* Top bar with Home button */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); setView('landing'); }}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
        >
          <Home className="h-4 w-4" />
          {t('common.home')}
        </a>
      </div>

      {/* Page title */}
      {title && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-2 sm:px-6 lg:px-8">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-2xl font-bold text-foreground sm:text-3xl"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-2 text-sm text-muted-foreground sm:text-base"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      )}

      {/* Content */}
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-4 sm:px-6 sm:pb-16 lg:px-8"
      >
        {children}
      </motion.main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
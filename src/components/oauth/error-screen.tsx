'use client';

/**
 * ─────────────────────────────────────────────────────────────────
 * OAuth authorization error screen
 * ─────────────────────────────────────────────────────────────────
 *
 * Rendered by GET /oauth/authorize for requests that cannot even be
 * safely redirected (unknown client_id, unregistered redirect_uri).
 * These errors are deliberately shown ON midman.bd — the browser is
 * NEVER redirected to an unvalidated destination.
 */

import { motion } from 'framer-motion';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

export type OAuthErrorCode = 'invalid_client' | 'invalid_redirect' | 'invalid_scope' | 'invalid_request' | 'server_error';

export function OAuthErrorScreen({ code }: { code: OAuthErrorCode }) {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F4F7] dark:bg-[#09090b] p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-border bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <XCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-foreground">{t('oauth.errorTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t(`oauth.error.${code}`)}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-xl text-sm font-semibold border border-border bg-transparent text-foreground hover:bg-muted dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('oauth.backHome')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

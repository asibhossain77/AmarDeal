'use client';

/**
 * ─────────────────────────────────────────────────────────────────
 * OAuth consent screen — "Sign in with Midman"
 * ─────────────────────────────────────────────────────────────────
 *
 * Rendered by GET /oauth/authorize when the user already has a
 * Midman session. Shows which app is requesting access, which
 * identity fields will be shared, and offers Continue / Cancel.
 *
 * The consent decision is submitted as a native same-origin form
 * POST to /api/oauth/authorize carrying an HMAC-signed consent
 * token (bound to the user, client, redirect URI, PKCE challenge,
 * state and a 5-minute expiry). No user data is ever placed in
 * the POSTed form fields.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Mail, ShieldCheck, User, XCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { useSiteSettings } from '@/lib/use-site-settings';
import { cdnUrl } from '@/lib/cdn-url';
import { LoadingAnimation } from '@/components/shared/loading-animation';

const SCOPE_META: Record<string, { icon: typeof Mail; key: 'oauth.scopeOpenid' | 'oauth.scopeProfile' | 'oauth.scopeEmail' }> = {
  openid: { icon: ShieldCheck, key: 'oauth.scopeOpenid' },
  profile: { icon: User, key: 'oauth.scopeProfile' },
  email: { icon: Mail, key: 'oauth.scopeEmail' },
};

export function OAuthConsent({
  userName,
  userEmail,
  userImage,
  clientName,
  clientHost,
  scopes,
  consentToken,
}: {
  userName: string;
  userEmail: string;
  userImage: string | null;
  clientName: string;
  clientHost: string;
  scopes: string[];
  consentToken: string;
}) {
  const locale = useAppStore((s) => s.locale);
  const { t } = useTranslation(locale);
  const { siteLogo, siteName } = useSiteSettings();
  const [processing, setProcessing] = useState<'continue' | 'deny' | null>(null);

  const initial = (userName || '?').trim().charAt(0).toUpperCase();
  const avatarUrl = cdnUrl(userImage);

  const handleSubmit = (decision: 'continue' | 'deny') => {
    if (processing) return;
    setProcessing(decision);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F4F7] dark:bg-[#09090b] p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        {/* Midman branding */}
        <div className="flex flex-col items-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteLogo || '/logo.svg'}
            alt={siteName || 'Midman'}
            className="h-12 w-12 rounded-xl object-contain"
          />
          <span className="text-sm font-semibold text-muted-foreground">{siteName || 'Midman'}</span>
        </div>

        <div className="rounded-2xl border border-border bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-bold text-center text-foreground">{t('oauth.title')}</h1>
          <p className="mt-2 text-sm text-center text-muted-foreground">
            {t('oauth.wantsAccess', { app: clientHost })}
          </p>

          {/* Signed-in identity */}
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 dark:bg-zinc-800/50 p-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={userName}
                className="h-12 w-12 rounded-full object-cover border border-border/60"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary select-none">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('oauth.signedInAs')}</p>
              <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>

          {/* Requested permissions */}
          <div className="mt-6">
            <p className="text-sm font-medium text-foreground">
              {t('oauth.allowListTitle', { app: clientHost })}
            </p>
            <ul className="mt-3 space-y-2.5">
              {scopes.map((scope) => {
                const meta = SCOPE_META[scope];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <li key={scope} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Icon className="h-4.5 w-4.5 mt-0.5 shrink-0 text-primary" />
                    <span>{t(meta.key)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Security note */}
          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/20 p-3.5">
            <ShieldCheck className="h-4.5 w-4.5 mt-0.5 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">{t('oauth.securityNote')}</p>
          </div>

          {/* Consent form — native POST to same origin (CSP form-action 'self') */}
          <form method="POST" action="/api/oauth/authorize" className="mt-6 space-y-3">
            <input type="hidden" name="consent_token" value={consentToken} />
            <button
              type="submit"
              name="decision"
              value="continue"
              disabled={!!processing}
              onClick={() => handleSubmit('continue')}
              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 gap-2.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {processing === 'continue' ? <LoadingAnimation size="sm" /> : <CheckCircle2 className="h-5 w-5" />}
              {processing === 'continue' ? t('oauth.processing') : t('oauth.continue')}
            </button>
            <button
              type="submit"
              name="decision"
              value="deny"
              disabled={!!processing}
              onClick={() => handleSubmit('deny')}
              className="w-full h-12 rounded-xl text-base font-semibold gap-2.5 border border-border bg-transparent text-foreground hover:bg-muted dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {processing === 'deny' ? <LoadingAnimation size="sm" /> : <XCircle className="h-5 w-5" />}
              {processing === 'deny' ? t('oauth.processing') : t('oauth.cancel')}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          {t('oauth.signedInNote')}
        </p>
      </motion.div>
    </div>
  );
}

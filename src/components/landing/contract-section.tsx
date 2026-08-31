'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useEffect, useSyncExternalStore } from 'react';
import { FileText } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';

const emptySubscribe = () => () => {};

interface ContractData {
  content: string;
  adminName: string;
  adminImageUrl: string;
}

export function ContractSection() {
  const t = useT();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/contract')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!mounted || loading) {
    return (
      <section id="terms" className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      </section>
    );
  }

  const contentLines = data?.content
    ? data.content.split('\n').filter((l) => l.trim())
    : [];

  return (
    <section id="terms" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
            {t('contract.sectionLabel')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('contract.sectionTitle')}
          </h2>
        </div>

        {/* Admin Info Card */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5 mb-5">
          <div className="flex items-center gap-4">
            {data?.adminImageUrl ? (
              <img
                src={cdnUrl(data.adminImageUrl) || ''}
                alt={data.adminName || t('contact.admin')}
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                loading="lazy" decoding="async"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">
                {(data?.adminName || 'A').charAt(0)}
              </div>
            )}
            <div>
              <p className="text-base font-bold text-foreground">
                {data?.adminName || t('contract.admin')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('contract.platformAdmin')}
              </p>
            </div>
          </div>
        </div>

        {/* Contract Content Card */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {t('contract.termsTitle')}
            </h3>
          </div>

          {contentLines.length > 0 ? (
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {contentLines.map((line, i) => {
                const trimmed = line.trim();
                // Detect headings (lines ending with : or starting with #)
                if (trimmed.endsWith(':') || trimmed.startsWith('#')) {
                  const text = trimmed.replace(/^#+\s*/, '').replace(/:$/, '');
                  return (
                    <h4
                      key={i}
                      className="text-base font-semibold text-foreground mt-4 first:mt-0"
                    >
                      {text}
                    </h4>
                  );
                }
                // Detect bullet points
                if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('•')) {
                  return (
                    <div key={i} className="flex gap-2 pl-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      <span>{trimmed.replace(/^[-•]\s*/, '')}</span>
                    </div>
                  );
                }
                return <p key={i}>{trimmed}</p>;
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t('contract.noTerms')}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
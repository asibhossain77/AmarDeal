'use client';

import { LoadingAnimation } from '@/components/shared/loading-animation'
import { useState, useEffect, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  MapPin,
  Users,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Headset,
  Share2,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cdnUrl } from '@/lib/cdn-url';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const emptySubscribe = () => () => {};

/* ── Brand icons (inline SVG, fill-based — recognizable glyphs) ── */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/* ── Data ── */
interface ContactData {
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  telegram: string | null;
  telegramGroup: string | null;
  facebook: string | null;
  facebookPage: string | null;
  facebookGroup: string | null;
  address: string | null;
  mapUrl: string;
  adminName: string;
  adminImageUrl: string;
}

type FormState = { name: string; email: string; subject: string; message: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const viewportOnce = { once: true, margin: '-40px' } as const;

/* ── Generic channel card ── */
function ChannelCard({
  icon,
  iconClass,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  action: React.ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}>
      <div className="flex h-full flex-col rounded-2xl border border-border/40 bg-white p-5 shadow-lg shadow-gray-200/60 transition-all duration-300 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/5 dark:bg-zinc-900 dark:shadow-none">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">{label}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground sm:text-[15px]">{value}</p>
          </div>
        </div>
        <div className="mt-4 flex-1" />
        {action}
      </div>
    </motion.div>
  );
}

/* ── Section heading ── */
function SectionHeading({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className="mb-4 flex items-center gap-2.5"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{text}</h2>
    </motion.div>
  );
}

/* ── Main page ── */
export function ContactSection() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const t = useT();
  const [data, setData] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mounted) return;
    fetch('/api/contact-info')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mounted]);

  /* Form state */
  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  if (!mounted || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8 flex items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  const phoneHref = data?.phone ? `tel:${data.phone.replace(/[^\d+]/g, '')}` : '';
  const waRaw = data?.whatsapp || '';
  const waNumber = waRaw
    ? (waRaw.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\+?\d[\d\s-]*)/i)?.[1] || '').trim()
    : '';
  const waHref = waRaw || '';

  const hasProfile = Boolean(data?.adminName || data?.adminImageUrl);
  const hasLocation = Boolean(data?.address || data?.mapUrl);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (form.name.trim().length < 2) e.name = t('contact.errName');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = t('contact.errEmail');
    if (form.subject.trim().length < 3) e.subject = t('contact.errSubject');
    if (form.message.trim().length < 10) e.message = t('contact.errMessage');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updateField = (key: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSent(false);
    setFormError('');
    if (!validate()) return;
    setSending(true);
    try {
      const res = await fetch('/api/contact-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setSent(true);
        setForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setFormError(json.error || t('contact.formError'));
      }
    } catch {
      setFormError(t('contact.formError'));
    } finally {
      setSending(false);
    }
  };

  const inputCls = 'rounded-xl border-border/60 bg-background';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
      {/* ── Hero description ── */}
      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="mx-auto mb-10 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground sm:text-[15px]"
      >
        {t('contact.heroDesc')}
      </motion.p>

      {/* ── Admin Profile Card ── */}
      {hasProfile && (
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          aria-label={t('contact.admin')}
          className="relative mx-auto mb-10 overflow-hidden rounded-3xl border border-border/40 bg-white p-6 shadow-xl shadow-gray-200/60 sm:p-8 dark:bg-zinc-900 dark:shadow-none"
        >
          {/* soft green gradient accent */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.07] to-transparent" />
          <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="absolute -inset-2 rounded-full bg-primary/10 blur-lg" aria-hidden="true" />
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-lg shadow-gray-300/40 dark:border-zinc-800 dark:shadow-none sm:h-28 sm:w-28">
                {data?.adminImageUrl ? (
                  <img
                    src={cdnUrl(data.adminImageUrl) || ''}
                    alt={data.adminName || t('contact.admin')}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 to-primary/5">
                    <span className="text-3xl font-black text-primary sm:text-4xl">
                      {(data?.adminName || 'M').trim().charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              {/* Availability indicator */}
              <span
                className="absolute bottom-1 right-1 block h-5 w-5 rounded-full border-[3px] border-white bg-emerald-500 dark:border-zinc-800"
                role="img"
                aria-label={t('contact.available')}
              />
            </div>

            {/* Info */}
            <div className="min-w-0">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {data?.adminName || t('contact.admin')}
                </h2>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                  {t('contact.adminBadge')}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t('contact.adminDesc')}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="progress-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {t('contact.available')}
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Direct Channels: Phone / WhatsApp / Email ── */}
      {(data?.phone || waHref || data?.email) && (
        <section aria-label={t('contact.directChannels')} className="mb-10">
          <SectionHeading icon={<Headset className="h-4.5 w-4.5" strokeWidth={2} />} text={t('contact.directChannels')} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.phone && (
              <ChannelCard
                icon={<Phone className="h-5 w-5" strokeWidth={2} />}
                iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                label={t('contact.phone')}
                value={data.phone}
                action={
                  <a
                    href={phoneHref}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Phone className="h-4 w-4 text-primary" />
                    {t('contact.callNow')}
                  </a>
                }
              />
            )}
            {waHref && (
              <ChannelCard
                icon={<WhatsAppIcon className="h-5 w-5" />}
                iconClass="bg-[#25D366]/10 text-[#1da851]"
                label={t('contact.whatsapp')}
                value={waNumber || 'WhatsApp'}
                action={
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.98]"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    {t('contact.whatsappBtn')}
                  </a>
                }
              />
            )}
            {data?.email && (
              <ChannelCard
                icon={<Mail className="h-5 w-5" strokeWidth={2} />}
                iconClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                label={t('contact.emailLabel')}
                value={data.email}
                action={
                  <a
                    href={`mailto:${data.email}`}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Mail className="h-4 w-4 text-primary" />
                    {t('contact.emailBtn')}
                  </a>
                }
              />
            )}
          </div>
        </section>
      )}

      {/* ── Social & Community ── */}
      {(data?.facebookPage || data?.facebookGroup || data?.telegramGroup) && (
        <section aria-label={t('contact.socialCommunity')} className="mb-10">
          <SectionHeading icon={<Share2 className="h-4.5 w-4.5" strokeWidth={2} />} text={t('contact.socialCommunity')} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.facebookPage && (
              <ChannelCard
                icon={<FacebookIcon className="h-5 w-5" />}
                iconClass="bg-[#1877F2]/10 text-[#1877F2]"
                label={t('contact.fbPage')}
                value="Facebook Page"
                action={
                  <a
                    href={data.facebookPage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <ExternalLink className="h-4 w-4 text-primary" />
                    {t('contact.pageVisitBtn')}
                  </a>
                }
              />
            )}
            {data?.facebookGroup && (
              <ChannelCard
                icon={<FacebookIcon className="h-5 w-5" />}
                iconClass="bg-[#1877F2]/10 text-[#1877F2]"
                label={t('contact.fbGroup')}
                value="Facebook Group"
                action={
                  <a
                    href={data.facebookGroup}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Users className="h-4 w-4 text-primary" />
                    {t('contact.groupJoinBtn')}
                  </a>
                }
              />
            )}
            {data?.telegramGroup && (
              <ChannelCard
                icon={<TelegramIcon className="h-5 w-5" />}
                iconClass="bg-[#229ED9]/10 text-[#229ED9]"
                label={t('contact.tgGroup')}
                value="Telegram Group"
                action={
                  <a
                    href={data.telegramGroup}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <TelegramIcon className="h-4 w-4 text-primary" />
                    {t('contact.groupJoinBtn')}
                  </a>
                }
              />
            )}
          </div>
        </section>
      )}

      {/* ── Location + Contact Form ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Location card */}
        {hasLocation && (
          <motion.section
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            aria-label={t('contact.locationTitle')}
            className="flex flex-col overflow-hidden rounded-3xl border border-border/40 bg-white shadow-xl shadow-gray-200/60 dark:bg-zinc-900 dark:shadow-none"
          >
            <div className="p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <MapPin className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                    {t('contact.locationTitle')}
                  </h2>
                  <p className="text-xs text-muted-foreground">{t('contact.locationDesc')}</p>
                </div>
              </div>
              {data?.address && (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{data.address}</p>
              )}
            </div>

            {/* Map preview / placeholder */}
            <div className="relative mt-auto min-h-[220px] flex-1 border-t border-border/40">
              <div
                className="absolute inset-0 bg-muted/30 dark:bg-zinc-800/30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, oklch(0.768 0.189 131 / 0.18) 1.5px, transparent 1.5px)',
                  backgroundSize: '18px 18px',
                }}
                aria-hidden="true"
              />
              <div className="relative flex h-full min-h-[220px] flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-primary/15 blur-lg" aria-hidden="true" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                    <MapPin className="h-6 w-6" strokeWidth={2.2} />
                  </div>
                </div>
                {data?.mapUrl ? (
                  <a
                    href={data.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.98]"
                  >
                    <MapPin className="h-4 w-4" />
                    {t('contact.viewOnMap')}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('contact.mapNotSet')}</p>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {/* Contact Form card */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          aria-label={t('contact.formTitle')}
          className="rounded-3xl border border-border/40 bg-white p-6 shadow-xl shadow-gray-200/60 dark:bg-zinc-900 dark:shadow-none sm:p-7"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                {t('contact.formTitle')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('contact.formDesc')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-name" className="text-sm font-medium text-foreground">
                  {t('contact.formName')} <span className="text-red-500" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder={t('contact.formNamePh')}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'contact-name-error' : undefined}
                  className={inputCls}
                />
                {errors.name && (
                  <p id="contact-name-error" className="text-xs font-medium text-red-500">{errors.name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-email" className="text-sm font-medium text-foreground">
                  {t('contact.formEmail')} <span className="text-red-500" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder={t('contact.formEmailPh')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
                  className={inputCls}
                />
                {errors.email && (
                  <p id="contact-email-error" className="text-xs font-medium text-red-500">{errors.email}</p>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="contact-subject" className="text-sm font-medium text-foreground">
                {t('contact.formSubject')} <span className="text-red-500" aria-hidden="true">*</span>
              </Label>
              <Input
                id="contact-subject"
                name="subject"
                required
                value={form.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                placeholder={t('contact.formSubjectPh')}
                aria-invalid={Boolean(errors.subject)}
                aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
                className={inputCls}
              />
              {errors.subject && (
                <p id="contact-subject-error" className="text-xs font-medium text-red-500">{errors.subject}</p>
              )}
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="contact-message" className="text-sm font-medium text-foreground">
                {t('contact.formMessage')} <span className="text-red-500" aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                value={form.message}
                onChange={(e) => updateField('message', e.target.value)}
                placeholder={t('contact.formMessagePh')}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? 'contact-message-error' : undefined}
                className={`${inputCls} resize-y`}
              />
              {errors.message && (
                <p id="contact-message-error" className="text-xs font-medium text-red-500">{errors.message}</p>
              )}
            </div>

            {/* Success message */}
            {sent && (
              <div
                role="status"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
              >
                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                {t('contact.formSuccess')}
              </div>
            )}

            {/* Error message */}
            {formError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm font-medium text-red-600 dark:text-red-400"
              >
                <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                {formError}
              </div>
            )}

            <Button
              type="submit"
              disabled={sending}
              className="mt-5 h-12 w-full gap-2 rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] sm:w-auto sm:px-8"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  {t('contact.formSending')}
                </>
              ) : (
                <>
                  <Mail className="h-4.5 w-4.5" />
                  {t('contact.formSend')}
                </>
              )}
            </Button>
          </form>
        </motion.section>
      </div>
    </div>
  );
}

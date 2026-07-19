'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, MessageCircle, MapPin, Users, Loader2, User, Send } from 'lucide-react';

const emptySubscribe = () => () => {};

interface ContactData {
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  telegram: string | null;
  telegramGroup: string | null;
  facebook: string | null;
  facebookGroup: string | null;
  address: string | null;
  adminName: string;
  adminImageUrl: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

export function ContactSection() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
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

  if (!mounted || loading) {
    return (
      <section id="contact" className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  const items: { icon: React.ElementType; label: string; value: string; href?: string; color: string }[] = [];

  if (data?.phone) {
    items.push({ icon: Phone, label: 'ফোন', value: data.phone, href: `tel:${data.phone}`, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' });
  }
  if (data?.whatsapp) {
    items.push({ icon: MessageCircle, label: 'হোয়াটসঅ্যাপ', value: 'হোয়াটসঅ্যাপে মেসেজ করুন', href: data.whatsapp, color: 'bg-green-500/10 text-green-600 dark:text-green-400' });
  }
  if (data?.email) {
    items.push({ icon: Mail, label: 'ইমেইল', value: data.email, href: `mailto:${data.email}`, color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' });
  }
  if (data?.facebookGroup) {
    items.push({ icon: Users, label: 'ফেসবুক গ্রুপ', value: 'গ্রুপে যোগ দিন', href: data.facebookGroup, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' });
  }
  if (data?.telegramGroup) {
    items.push({ icon: Send, label: 'টেলিগ্রাম গ্রুপ', value: 'গ্রুপে যোগ দিন', href: data.telegramGroup, color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' });
  }
  if (data?.address) {
    items.push({ icon: MapPin, label: 'ঠিকানা', value: data.address, color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' });
  }

  const hasProfile = data?.adminName || data?.adminImageUrl;

  return (
    <section id="contact" className="py-20 sm:py-28 relative overflow-hidden">
      {/* Subtle background accent */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            যোগাযোগ
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            আমাদের সাথে কথা বলুন
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            যেকোনো প্রশ্ন বা সমস্যায় সরাসরি যোগাযোগ করুন
          </p>
        </motion.div>

        {/* Big Centered Admin Profile */}
        {hasProfile && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-12 flex flex-col items-center text-center"
          >
            {/* Decorative glow ring */}
            <div className="relative mb-5">
              <div className="absolute -inset-3 rounded-full bg-primary/10 blur-xl" />
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-white dark:border-zinc-800 shadow-2xl shadow-gray-400/30 dark:shadow-none overflow-hidden">
                {data?.adminImageUrl ? (
                  <img
                    src={data.adminImageUrl}
                    alt={data.adminName || 'অ্যাডমিন'}
                    className="h-full w-full object-cover"
                    loading="lazy" decoding="async"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-4xl sm:text-5xl font-black text-primary">
                      {(data?.adminName || 'অ').charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              {/* Online indicator dot */}
              <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-[3px] border-white dark:border-zinc-800 bg-emerald-500" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">
              {data?.adminName || 'প্ল্যাটফর্ম অ্যাডমিন'}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              যেকোনো সময় যোগাযোগ করুন
            </p>
          </motion.div>
        )}

        {/* Contact Items — Unique staggered layout */}
        {items.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="space-y-3"
          >
            {items.map((item, idx) => {
              const Icon = item.icon;
              const Wrapper = item.href ? 'a' : 'div';
              return (
                <motion.div key={idx} variants={itemVariants}>
                  <Wrapper
                    {...(item.href ? {
                      href: item.href,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    } : {})}
                    className="group flex items-center gap-4 rounded-2xl border border-border/40 bg-white/80 backdrop-blur-sm p-4 sm:p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 dark:bg-zinc-900/80 dark:shadow-none cursor-pointer"
                  >
                    {/* Colored icon */}
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.color} transition-transform duration-300 group-hover:scale-110`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{item.label}</p>
                      <p className="mt-0.5 text-sm sm:text-base font-semibold text-foreground truncate">{item.value}</p>
                    </div>
                    {/* Arrow indicator */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground/40 transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:translate-x-0.5">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Wrapper>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-white p-10 text-center shadow-lg dark:bg-zinc-900 dark:shadow-none">
            <User className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              এখনো যোগাযোগ তথ্য যোগ করা হয়নি
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
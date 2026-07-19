'use client';

import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

export function PrivacySection() {
  const t = useT();

  const sections = [
    {
      title: t('privacy.s1Title'),
      items: [
        t('privacy.s1i1'),
        t('privacy.s1i2'),
        t('privacy.s1i3'),
        t('privacy.s1i4'),
      ],
    },
    {
      title: t('privacy.s2Title'),
      items: [
        t('privacy.s2i1'),
        t('privacy.s2i2'),
        t('privacy.s2i3'),
        t('privacy.s2i4'),
        t('privacy.s2i5'),
      ],
    },
    {
      title: t('privacy.s3Title'),
      items: [
        t('privacy.s3i1'),
        t('privacy.s3i2'),
        t('privacy.s3i3'),
        t('privacy.s3i4'),
      ],
    },
    {
      title: t('privacy.s4Title'),
      items: [
        t('privacy.s4i1'),
        t('privacy.s4i2'),
        t('privacy.s4i3'),
        t('privacy.s4i4'),
      ],
    },
    {
      title: t('privacy.s5Title'),
      items: [
        t('privacy.s5i1'),
        t('privacy.s5i2'),
        t('privacy.s5i3'),
        t('privacy.s5i4'),
      ],
    },
    {
      title: t('privacy.s6Title'),
      items: [
        t('privacy.s6i1'),
        t('privacy.s6i2'),
        t('privacy.s6i3'),
        t('privacy.s6i4'),
      ],
    },
    {
      title: t('privacy.s7Title'),
      items: [
        t('privacy.s7i1'),
        t('privacy.s7i2'),
        t('privacy.s7i3'),
        t('privacy.s7i4'),
      ],
    },
    {
      title: t('privacy.s8Title'),
      items: [
        t('privacy.s8i1'),
        t('privacy.s8i2'),
        t('privacy.s8i3'),
      ],
    },
  ];

  return (
    <section id="privacy" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            {t('privacy.sectionLabel')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('privacy.sectionTitle')}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            {t('privacy.sectionDesc')}
          </p>
        </motion.div>

        {/* Last Updated Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-8 flex justify-center"
        >
          <span className="inline-flex items-center rounded-full bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            {t('privacy.lastUpdated')}
          </span>
        </motion.div>

        {/* Sections */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="space-y-5"
        >
          {sections.map((section, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className="rounded-2xl border border-border/40 bg-white p-5 sm:p-6 shadow-lg dark:bg-zinc-900 dark:shadow-none"
            >
              <h3 className="mb-4 text-base font-bold text-foreground">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* Contact Note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 text-center"
        >
          <div className="mx-auto max-w-xl rounded-2xl bg-primary/5 border border-primary/10 p-5 sm:p-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('privacy.contactNote')}{' '}
              <button
                onClick={() => useAppStore.getState().setView('page-contact')}
                className="font-semibold text-primary hover:underline underline-offset-2"
              >
                {t('privacy.contactLink')}
              </button>{' '}
              {t('privacy.contactNoteEnd')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
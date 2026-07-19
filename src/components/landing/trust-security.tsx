'use client';

import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Eye,
  Clock,
  Landmark,
  UserCheck,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' as const },
  },
};

export function TrustSecurity() {
  const t = useT();

  const features = [
    {
      icon: Lock,
      title: t('trust.feature1Title'),
      description: t('trust.feature1Desc'),
    },
    {
      icon: Eye,
      title: t('trust.feature2Title'),
      description: t('trust.feature2Desc'),
    },
    {
      icon: UserCheck,
      title: t('trust.feature3Title'),
      description: t('trust.feature3Desc'),
    },
    {
      icon: Landmark,
      title: t('trust.feature4Title'),
      description: t('trust.feature4Desc'),
    },
    {
      icon: Clock,
      title: t('trust.feature5Title'),
      description: t('trust.feature5Desc'),
    },
    {
      icon: ShieldCheck,
      title: t('trust.feature6Title'),
      description: t('trust.feature6Desc'),
    },
  ];

  return (
    <section id="features" className="border-t border-border/50 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            {t('trust.sectionLabel')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {t('trust.sectionTitle')}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {t('trust.sectionDesc')}
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="rounded-3xl border border-border/40 bg-white p-5 sm:p-6 shadow-2xl shadow-gray-300/50 transition-all duration-300 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/10 dark:bg-zinc-900 dark:shadow-none"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
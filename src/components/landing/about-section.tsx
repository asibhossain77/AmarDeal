'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Users, Target, Heart, Award, TrendingUp } from 'lucide-react';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
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

export function AboutSection() {
  const { siteName, siteNameEn } = useSiteSettings();
  const locale = useAppStore((s) => s.locale);
  const displayName = locale === 'en' ? siteNameEn : siteName;
  const t = useT();

  const stats = [
    { icon: ShieldCheck, value: '১০০%', label: t('about.stat1Label') },
    { icon: Users, value: '২৪/৭', label: t('about.stat2Label') },
    { icon: Award, value: '০%', label: t('about.stat3Label') },
    { icon: TrendingUp, value: 'দ্রুত', label: t('about.stat4Label') },
  ];

  const values = [
    {
      icon: ShieldCheck,
      title: t('about.value1Title'),
      description: t('about.value1Desc'),
    },
    {
      icon: Target,
      title: t('about.value2Title'),
      description: t('about.value2Desc'),
    },
    {
      icon: Users,
      title: t('about.value3Title'),
      description: t('about.value3Desc'),
    },
    {
      icon: Heart,
      title: t('about.value4Title'),
      description: t('about.value4Desc'),
    },
  ];

  const milestones = [
    {
      phase: t('about.goalPhase'),
      text: t('about.goalText'),
    },
    {
      phase: t('about.methodPhase'),
      text: t('about.methodText'),
    },
    {
      phase: t('about.promisePhase'),
      text: t('about.promiseText'),
    },
  ];

  return (
    <section id="about" className="py-20 sm:py-28">
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
            {t('about.sectionLabel')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {t('about.sectionTitle')}
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            {t('about.sectionDesc')}
          </p>
        </motion.div>

        {/* Mission / Intro Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-16 rounded-3xl border border-border/40 bg-white p-6 sm:p-10 shadow-2xl shadow-gray-300/50 dark:bg-zinc-900 dark:shadow-none"
        >
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h3 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">
                {t('about.missionTitle')}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('about.missionText')}
              </p>
            </div>
            <div className="space-y-5">
              {milestones.map((m) => (
                <div key={m.phase} className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{m.phase}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="mb-16 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className="rounded-2xl border border-border/40 bg-white p-5 text-center shadow-lg dark:bg-zinc-900"
              >
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground font-medium">{stat.label}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Values Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="mb-10 grid gap-5 sm:grid-cols-2"
        >
          {values.map((v) => {
            const Icon = v.icon;
            return (
              <motion.div
                key={v.title}
                variants={itemVariants}
                className="group rounded-2xl border border-border/40 bg-white p-6 shadow-lg transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 dark:bg-zinc-900 dark:shadow-none sm:p-7"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold">{v.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{v.description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom Statement */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-center"
        >
          <div className="mx-auto max-w-xl rounded-2xl bg-primary/5 border border-primary/10 p-6 sm:p-8">
            <p className="text-lg font-bold text-foreground sm:text-xl">
              {t('about.quote')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              — {displayName} {t('about.familyLabel')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
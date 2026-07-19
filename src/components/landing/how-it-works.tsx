'use client';

import { motion } from 'framer-motion';
import { FileText, Wallet, CheckCircle } from 'lucide-react';
import { useT } from '@/lib/i18n';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export function HowItWorks() {
  const t = useT();

  const stepNumbers = ['01', '02', '03'];

  const steps = [
    {
      icon: FileText,
      title: t('how.step1Title'),
      description: t('how.step1Desc'),
    },
    {
      icon: Wallet,
      title: t('how.step2Title'),
      description: t('how.step2Desc'),
    },
    {
      icon: CheckCircle,
      title: t('how.step3Title'),
      description: t('how.step3Desc'),
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-28">
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
            {t('how.sectionLabel')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {t('how.sectionTitle')}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {t('how.sectionDesc')}
          </p>
        </motion.div>

        {/* Steps Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={stepNumbers[index]}
                variants={itemVariants}
                className="group relative rounded-3xl border border-border/40 bg-white p-6 sm:p-8 shadow-2xl shadow-gray-300/50 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 dark:bg-zinc-900 dark:shadow-none"
              >
                {index < steps.length - 1 && (
                  <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 border-t border-dashed border-primary/30 lg:block" />
                )}

                <span className="mb-4 inline-block font-mono text-3xl font-black text-primary/50">
                  {stepNumbers[index]}
                </span>

                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
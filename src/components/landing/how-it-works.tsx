'use client';

import { motion } from 'framer-motion';
import { FileText, Wallet, CheckCircle } from 'lucide-react';

const steps = [
  {
    number: '০১',
    icon: FileText,
    title: 'ডিল তৈরি করুন',
    description:
      'ক্রেতা ও বিক্রেতা মিলে এসক্রো ডিল তৈরি করুন। লেনদেনের শর্তাবলী স্পষ্টভাবে উল্লেখ করুন।',
  },
  {
    number: '০২',
    icon: Wallet,
    title: 'টাকা জমা দিন',
    description:
      'ক্রেতা নিরাপদে এসক্রো অ্যাকাউন্টে টাকা জমা দিন। টাকা সম্পূর্ণ সুরক্ষিত থাকবে ডিল সম্পন্ন না হওয়া পর্যন্ত।',
  },
  {
    number: '০৩',
    icon: CheckCircle,
    title: 'নিরাপদে লেনদেন সম্পন্ন করুন',
    description:
      'শর্ত পূরণ হলে বিক্রেতাকে টাকা প্রদান করা হবে। কোনো পক্ষ শর্ত ভঙ্গ করলে টাকা ক্রেতাকে ফেরত দেওয়া হবে।',
  },
];

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
            কিভাবে কাজ করে
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            মাত্র তিনটি ধাপে নিরাপদ লেনদেন
          </h2>
          <p className="mt-4 text-muted-foreground">
            জটিল প্রক্রিয়া নয়, সহজ ও স্বচ্ছ পদ্ধতিতে আপনার লেনদেন
            সম্পন্ন করুন।
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
                key={step.number}
                variants={itemVariants}
                className="group relative rounded-3xl border border-border/40 bg-white p-6 sm:p-8 shadow-2xl shadow-gray-300/50 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 dark:bg-zinc-900 dark:shadow-none"
              >
                {index < steps.length - 1 && (
                  <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 border-t border-dashed border-primary/30 lg:block" />
                )}

                <span className="mb-4 inline-block font-mono text-3xl font-black text-primary/50">
                  {step.number}
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
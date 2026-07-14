'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Users, Target, Heart, Award, TrendingUp } from 'lucide-react';
import { useSiteSettings } from '@/lib/use-site-settings';

const stats = [
  { icon: ShieldCheck, value: '১০০%', label: 'নিরাপদ লেনদেন' },
  { icon: Users, value: '২৪/৭', label: 'সাপোর্ট' },
  { icon: Award, value: '০%', label: 'প্রতারণার হার' },
  { icon: TrendingUp, value: 'দ্রুত', label: 'পেআউট প্রক্রিয়া' },
];

const values = [
  {
    icon: ShieldCheck,
    title: 'নিরাপত্তা সর্বোচ্চ অগ্রাধিকার',
    description:
      'আমাদের প্ল্যাটফর্মে প্রতিটি লেনদেন এন্ড-টু-এন্ড এনক্রিপশন দিয়ে সুরক্ষিত। আপনার টাকা ডিল সম্পন্ন না হওয়া পর্যন্ত লক থাকে। কোনো তৃতীয় পক্ষ আপনার তথ্যে অ্যাক্সেস করতে পারে না।',
  },
  {
    icon: Target,
    title: 'স্বচ্ছতা ও জবাবদিহিতা',
    description:
      'প্রতিটি ডিলের সব ধাপ রিয়েল-টাইমে আপডেট হয়। কখন টাকা জমা হলো, কখন ভেরিফাই হলো, কখন ডেলিভারি হলো — সবকিছু আপনার সামনে স্বচ্ছভাবে দেখা যায়।',
  },
  {
    icon: Users,
    title: 'ক্রেতা-বিক্রেতা সম্পর্ক সুরক্ষা',
    description:
      'অনলাইনে কেনাবেচার সবচেয়ে বড় সমস্যা হলো বিশ্বাসের অভাব। আমরা সেই শূন্যস্থান পূরণ করি। ক্রেতা নিশ্চিন্তে পেমেন্ট করেন, বিক্রেতা নিশ্চিন্তে ডেলিভারি দেন।',
  },
  {
    icon: Heart,
    title: 'দ্রুত বিরোধ নিষ্পত্তি',
    description:
      'কোনো সমস্যা হলে অ্যাডমিন সরাসরি হস্তক্ষেপ করেন। চ্যাটের মাধ্যমে উভয় পক্ষের কথা শুনে দ্রুত সিদ্ধান্ত নেওয়া হয়। অযথা সময় নষ্ট হয় না।',
  },
];

const milestones = [
  {
    phase: 'আমাদের লক্ষ্য',
    text: 'বাংলাদেশের প্রতিটি অনলাইন লেনদেনকে নিরাপদ করা। কেউ প্রতারিত হবে না — এটাই আমাদের প্রতিশ্রুতি।',
  },
  {
    phase: 'আমাদের পদ্ধতি',
    text: 'মানুষের জন্য সহজ, প্রতারকদের জন্য কঠোর। আমরা প্রযুক্তি ও ম্যানুয়াল ভেরিফিকেশনের সমন্বয়ে কাজ করি যাতে কোনো ফাঁকফোকর না থাকে।',
  },
  {
    phase: 'আমাদের প্রতিশ্রুতি',
    text: 'আপনার টাকা আমাদের দায়িত্ব। আমরা একটি টাকাও অন্যায়ভাবে যেতে দেব না। প্রতিটি ডিলে আমরা নিরপেক্ষ মধ্যস্থ হিসেবে কাজ করি।',
  },
];

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
  const { siteName } = useSiteSettings();

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
            আমাদের সম্পর্কে
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            নিরাপদ লেনদেনের বিশ্বস্ত ঠিকানা
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            {siteName} হলো বাংলাদেশের একটি এসক্রো প্ল্যাটফর্ম যা অনলাইন কেনাবেচাকে নিরাপদ ও স্বচ্ছ করে।
            আমরা বিশ্বাস করি প্রতিটি লেনদেন প্রতারণামুক্ত হওয়া উচিত।
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
                আমাদের মিশন
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                বাংলাদেশে অনলাইনে কেনাবেচার পরিমাণ দিন দিন বাড়ছে, কিন্তু প্রতারণার ভয়ে অনেকেই পিছিয়ে আসছেন।
                {siteName} এই সমস্যার সমাধান নিয়ে এসেছে। আমাদের মিশন হলো প্রতিটি অনলাইন লেনদেনে একটি বিশ্বস্ত তৃতীয় পক্ষ
                হিসেবে কাজ করা — যাতে ক্রেতা তার টাকা হারান না এবং বিক্রেতা তার পণ্যের মূল্য পায়।
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
              &quot;আপনার টাকা, আমাদের দায়িত্ব&quot;
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              — {siteName} পরিবার
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
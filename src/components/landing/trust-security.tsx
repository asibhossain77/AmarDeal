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

const features = [
  {
    icon: Lock,
    title: 'এন্ড-টু-এন্ড এনক্রিপশন',
    description:
      'আপনার সকল তথ্য ও লেনদেনের ডেটা শক্তিশালী এনক্রিপশন প্রযুক্তি দিয়ে সুরক্ষিত।',
  },
  {
    icon: Eye,
    title: 'স্বচ্ছ লেনদেন প্রক্রিয়া',
    description:
      'প্রতিটি ধাপে রিয়েল-টাইম আপডেট পান। লেনদেনের অবস্থা সবসময় আপনার হাতের মুঠোয়।',
  },
  {
    icon: UserCheck,
    title: 'যাচাইকৃত ব্যবহারকারী',
    description:
      'সকল ব্যবহারকারীকে যাচাই করা হয়। প্রতারণার ঝুঁকি হ্রাস পায় এবং বিশ্বাস বৃদ্ধি পায়।',
  },
  {
    icon: Landmark,
    title: 'নিয়ন্ত্রিত অর্থ প্রদান',
    description:
      'লাইসেন্সপ্রাপ্ত আর্থিক প্রতিষ্ঠানের মাধ্যমে টাকা পরিচালনা করা হয়।',
  },
  {
    icon: Clock,
    title: 'দ্রুত বিরোধ নিষ্পত্তি',
    description:
      'যেকোনো সমস্যায় দ্রুত মধ্যস্থতার ব্যবস্থা। পেশাদার সাপোর্ট টিম ২৪/৭ আপনার পাশে।',
  },
  {
    icon: ShieldCheck,
    title: 'অর্থ ফেরতের গ্যারান্টি',
    description:
      'শর্ত পূরণ না হলে আপনার টাকা সম্পূর্ণ ফেরত পাবেন। কোনো লুকানো চার্জ নেই।',
  },
];

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
            নিরাপত্তা ও ভরসা
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            আপনার লেনদেন সম্পূর্ণ সুরক্ষিত
          </h2>
          <p className="mt-4 text-muted-foreground">
            আমরা সর্বোচ্চ নিরাপত্তা মান অনুসরণ করি যাতে আপনি নিশ্চিন্তে
            লেনদেন করতে পারেন।
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
'use client';

import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const sections = [
  {
    title: '১. তথ্য সংগ্রহ',
    items: [
      'আমরা রেজিস্ট্রেশনের সময় আপনার নাম, ফোন নম্বর ও পাসওয়ার্ড সংগ্রহ করি।',
      'ডিল তৈরির সময় লেনদেনের তথ্য (পরিমাণ, শর্ত, পেমেন্ট মেথড) সংরক্ষণ হয়।',
      'চ্যাট মেসেজ ও ডিল সম্পর্কিত যোগাযোগের তথ্য সংগ্রহ করা হয়।',
      'পেমেন্ট প্রুফ (স্ক্রিনশট/ট্রানজাকশন আইডি) ভেরিফিকেশনের জন্য সংগৃহীত হয়।',
    ],
  },
  {
    title: '২. তথ্যের ব্যবহার',
    items: [
      'লেনদেন পরিচালনা, ভেরিফিকেশন ও পেআউট প্রক্রিয়ার জন্য।',
      'বিরোধ নিষ্পত্তির সময় প্রমাণ হিসেবে ব্যবহার করা হয়।',
      'প্ল্যাটফর্মের নিরাপত্তা ও সেবার মান উন্নয়নে।',
      'অবৈধ কার্যকলাপ ও প্রতারণা প্রতিরোধে।',
      'প্রয়োজনে আপনাকে গুরুত্বপূর্ণ নোটিফিকেশন পাঠানোর জন্য।',
    ],
  },
  {
    title: '৩. তথ্য সুরক্ষা',
    items: [
      'সকল ডেটা এন্ড-টু-এন্ড এনক্রিপশন দিয়ে সুরক্ষিত।',
      'আপনার পাসওয়ার্ড হ্যাশ করে সংরক্ষণ করা হয় — আমরাও দেখতে পাই না।',
      'শুধুমাত্র অ্যাডমিন ও সংশ্লিষ্ট ডিলের পক্ষগণ ডিলের তথ্য দেখতে পারে।',
      'নিয়মিত সুরক্ষা অডিট ও আপডেটের মাধ্যমে ডেটা সুরক্ষিত রাখা হয়।',
    ],
  },
  {
    title: '৪. তৃতীয় পক্ষের সাথে শেয়ারিং',
    items: [
      'আমরা আপনার ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষকে বিক্রি, ভাড়া বা শেয়ার করি না।',
      'ডিলের অন্য পক্ষ (ক্রেতা/বিক্রেতা) শুধুমাত্র সংশ্লিষ্ট ডিলের প্রয়োজনীয় তথ্য দেখতে পারে।',
      'আইন প্রয়োগকারী সংস্থার আইনি অনুরোধে তথ্য প্রদান করা হতে পারে।',
      'পেমেন্ট প্রসেসিংয়ের জন্য পেমেন্ট গেটওয়েকে ন্যূনতম তথ্য দেওয়া হয়।',
    ],
  },
  {
    title: '৫. কুকিজ ও ট্র্যাকিং',
    items: [
      'আমরা আপনার লগইন সেশন বজায় রাখতে কুকিজ ব্যবহার করি।',
      'সাইটের পারফরম্যান্স ও ব্যবহারের অভিজ্ঞতা উন্নয়নে কুকিজ ব্যবহৃত হয়।',
      'আপনি আপনার ব্রাউজার সেটিং থেকে কুকিজ নিষ্ক্রিয় করতে পারেন, তবে কিছু ফিচার কাজ নাও করতে পারে।',
      'আমরা কোনো থার্ড-পার্টি ট্র্যাকিং বা অ্যাড ট্র্যাকিং কুকিজ ব্যবহার করি না।',
    ],
  },
  {
    title: '৬. তথ্য সংরক্ষণের সময়কাল',
    items: [
      'আপনার একাউন্ট যতদিন সক্রিয় থাকে ততদিন তথ্য সংরক্ষিত থাকে।',
      'ডিল সম্পূর্ণ হওয়ার পর ডিলের রেকর্ড আইনি প্রয়োজনে ন্যূনতম ৬ মাস পর্যন্ত রাখা হয়।',
      'অ্যাকাউন্ট মুছে ফেলার অনুরোধে ৩০ দিনের মধ্যে ব্যক্তিগত তথ্য ডিলিট করা হয় (আইনি রেকর্ড ব্যতিরেকে)।',
      'অনুমোদন ছাড়া আপনার তথ্য স্বয়ংক্রিয়ভাবে মুছে ফেলা হয় না।',
    ],
  },
  {
    title: '৭. আপনার অধিকারসমূহ',
    items: [
      'আপনি যেকোনো সময় আপনার প্রোফাইল তথ্য দেখতে ও সম্পাদনা করতে পারেন।',
      'আপনার তথ্য কিভাবে ব্যবহৃত হচ্ছে তা সম্পর্কে জানার অধিকার আপনার।',
      'অ্যাকাউন্ট মুছে ফেলার জন্য অ্যাডমিনকে অনুরোধ করতে পারেন।',
      'কোনো ভুল তথ্য সংশোধনের জন্য যোগাযোগ করতে পারেন।',
    ],
  },
  {
    title: '৮. নীতিতে পরিবর্তন',
    items: [
      'আমরা যেকোনো সময় এই গোপনীয়তা নীতি আপডেট করতে পারি।',
      'যদি কোনো উল্লেখযোগ্য পরিবর্তন হয়, তবে প্ল্যাটফর্মে নোটিফিকেশন দেওয়া হবে।',
      'নীতির সর্বশেষ সংস্করণ সবসময় এই পেজে পাওয়া যাবে।',
    ],
  },
];

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
            গোপনীয়তা নীতি
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            আপনার তথ্য সুরক্ষিত আছে
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            আমরা আপনার ব্যক্তিগত তথ্যের গুরুত্ব বুঝি। নিচে বিস্তারিত জানুন আমরা কিভাবে আপনার তথ্য সংগ্রহ, ব্যবহার ও সুরক্ষিত করি।
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
            সর্বশেষ আপডেট: জানুয়ারি ২০২৫
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
              গোপনীয়তা সম্পর্কে কোনো প্রশ্ন থাকলে আমাদের সাথে{' '}
              <button
                onClick={() => useAppStore.getState().setView('page-contact')}
                className="font-semibold text-primary hover:underline underline-offset-2"
              >
                যোগাযোগ
              </button>{' '}
              করুন। আমরা সবসময় আপনাকে সাহায্য করতে প্রস্তুত।
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
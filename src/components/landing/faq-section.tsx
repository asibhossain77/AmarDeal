'use client';

import { motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'এসক্রো কি?',
    answer:
      'এসক্রো (Escrow) হলো একটি নিরাপদ লেনদেন পদ্ধতি যেখানে ক্রেতার টাকা একটি তৃতীয় পক্ষের কাছে সংরক্ষণ করা হয়। বিক্রেতা শর্ত পূরণ করলে টাকা তাকে দেওয়া হয়, আর শর্ত ভঙ্গ হলে টাকা ক্রেতাকে ফেরত দেওয়া হয়। এতে উভয় পক্ষই নিরাপদ থাকে এবং প্রতারণার ঝুঁকি শূন্যে নেমে আসে।',
  },
  {
    question: 'এই প্ল্যাটফর্ম কিভাবে কাজ করে?',
    answer:
      'প্রথমে ক্রেতা একটি ডিল তৈরি করে। বিক্রেতা ডিলটি গ্রহণ করলে ক্রেতা পেমেন্ট করে। অ্যাডমিন পেমেন্ট ভেরিফাই করার পর বিক্রেতা পণ্য/সেবা ডেলিভারি দেয়। ক্রেতা কনফার্ম করলে বিক্রেতার কাছে পেআউট যায়। পুরো প্রক্রিয়ায় আপনার টাকা সম্পূর্ণ সুরক্ষিত।',
  },
  {
    question: 'আমি কিভাবে ডিল তৈরি করবো?',
    answer:
      'লগইন করার পর ড্যাশবোর্ডে "নতুন ডিল" বাটনে ক্লিক করুন। ডিলের টাইটেল, পরিমাণ ও বিবরণ লিখুন। বিক্রেতার ফোন নম্বর দিয়ে তাকে ইনভাইট করুন। বিক্রেতা একাউন্ট থাকলে সরাসরি ডিল দেখতে পাবে, না থাকলে রেজিস্ট্রেশন করতে হবে।',
  },
  {
    question: 'পেমেন্ট কিভাবে করতে হয়?',
    answer:
      'ডিল তৈরি ও গ্রহণের পর আপনার ডিল পেজে পেমেন্ট অপশন আসবে। অ্যাডমিন কর্তৃক সেট করা পেমেন্ট মেথড (বিকাশ, নগদ, রকেট ইত্যাদি) থেকে বেছে নিন এবং নির্দেশিত নম্বরে টাকা পাঠান। পেমেন্ট প্রুফ (স্ক্রিনশট/ট্রানজাকশন আইডি) জমা দিন। অ্যাডমিন ভেরিফাই করলে পরবর্তী ধাপে যাবে।',
  },
  {
    question: 'লেনদেনের ফি কত?',
    answer:
      'ফি ডিলের পরিমাণের উপর নির্ভর করে। ছোট ডিলে ফি কম এবং বড় ডিলে ফি বেশি। হোম পেজের "ফি কাঠামো" সেকশনে বিস্তারিত দেখতে পাবেন। ফি পেমেন্টের সাথে যুক্ত থাকে এবং সম্পূর্ণ স্বচ্ছভাবে দেখানো হয়।',
  },
  {
    question: 'আমার টাকা কি নিরাপদ?',
    answer:
      'অবশ্যই! প্ল্যাটফর্মটি এন্ড-টু-এন্ড এনক্রিপশন ব্যবহার করে। আপনার টাকা ডিল সম্পন্ন না হওয়া পর্যন্ত এসক্রোতে লক থাকে। কোনো পক্ষ একতরফাভাবে টাকা তুলতে পারে না। অ্যাডমিন প্রতিটি পেমেন্ট ম্যানুয়ালি ভেরিফাই করে।',
  },
  {
    question: 'যদি বিক্রেতা পণ্য না দেয় তাহলে কি হবে?',
    answer:
      'ডিলে সময়সীমা শেষ হলে বা বিক্রেতা ডেলিভারি না দিলে ক্রেতা বিরোধ (Dispute) দায়ের করতে পারে। অ্যাডমিন উভয় পক্ষের কথা শুনে সিদ্ধান্ত নেবে। বিক্রেতা দোষী হলে ক্রেতার পুরো টাকা ফেরত দেওয়া হবে।',
  },
  {
    question: 'রিফান্ড কিভাবে পাবো?',
    answer:
      'ডিল বাতিল হলে বা বিরোধ নিষ্পত্তিতে আপনার পক্ষে রায় আসলে রিফান্ড রিকোয়েস্ট অপশন আসবে। আপনার ব্যাংক একাউন্ট বা বিকাশ নম্বর দিন, অ্যাডমিন ভেরিফাই করে সর্বোচ্চ ২৪-৪৮ ঘন্টার মধ্যে টাকা ফেরত দেবে।',
  },
  {
    question: 'পেআউট কত সময়ে পাবো?',
    answer:
      'ক্রেতা ডেলিভারি কনফার্ম করার পর বিক্রেতা পেআউট রিকোয়েস্ট করতে পারে। অ্যাডমিন পেআউট অনুমোদন করলে সাধারণত ২৪-৪৮ ঘন্টার মধ্যে টাকা আপনার অ্যাকাউন্টে পৌঁছে যাবে।',
  },
  {
    question: 'একাউন্ট কিভাবে খুলবো?',
    answer:
      'হোম পেজ থেকে "লগইন/রেজিস্ট্রেশন" বাটনে ক্লিক করুন। আপনার নাম, ফোন নম্বর ও পাসওয়ার্ড দিয়ে সহজেই একাউন্ট খুলতে পারবেন। রেজিস্ট্রেশন সম্পূর্ণ বিনামূল্যে। একাউন্ট যাচাই করার পর আপনি ডিল তৈরি ও গ্রহণ করতে পারবেন।',
  },
  {
    question: 'ডিল বাতিল করা যায় কি?',
    answer:
      'হ্যাঁ, নির্দিষ্ট শর্তে ডিল বাতিল করা যায়। পেমেন্ট ভেরিফিকেশনের আগে যেকোনো পক্ষ ডিল বাতিল করতে পারে। পেমেন্ট ভেরিফাইড হলে বিরোধ প্রক্রিয়ার মাধ্যমে সমাধান করতে হবে। বাতিলের কারণ অ্যাডমিন যাচাই করবে।',
  },
  {
    question: 'ডিল আইডি (DL-XXXXX) কিসের কাজে লাগে?',
    answer:
      'প্রতিটি ডিলে একটি ইউনিক আইডি থাকে (যেমন: DL-abc12)। এটি দিয়ে সহজেই নির্দিষ্ট ডিল খুঁজে পাওয়া যায়। "আমার ডিল" পেজে সার্চ বক্সে ডিল আইডি টাইপ করলে সেই ডিল দেখাবে। সাপোর্টের সাথে যোগাযোগের সময় ডিল আইডি দিলে দ্রুত সমাধান পাওয়া যায়।',
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
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

export function FAQSection() {
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HelpCircle className="h-6 w-6" />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            সাধারণ প্রশ্ন
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            ঘন ঘন জিজ্ঞাসিত প্রশ্নাবলী
          </h2>
          <p className="mt-4 text-muted-foreground">
            আমাদের প্ল্যাটফর্ম সম্পর্কে সাধারণ প্রশ্ন ও উত্তর এখানে পাবেন
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="rounded-3xl border border-border/40 bg-white p-2 sm:p-3 shadow-2xl shadow-gray-300/50 dark:bg-zinc-900 dark:shadow-none"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <motion.div key={index} variants={itemVariants}>
                <AccordionItem
                  value={`faq-${index}`}
                  className="border-border/30 px-4 sm:px-5 data-[state=open]:bg-muted/40 rounded-xl transition-colors"
                >
                  <AccordionTrigger className="text-left text-sm sm:text-base font-semibold text-foreground hover:no-underline py-4 sm:py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground pb-4 sm:pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 text-center"
        >
          <p className="text-sm text-muted-foreground">
            আপনার প্রশ্নের উত্তর পাননি?{' '}
            <button
              onClick={() => useAppStore.getState().setView('page-security')}
              className="font-semibold text-primary hover:underline underline-offset-2"
            >
              নিরাপত্তা ফিচার দেখুন
            </button>{' '}
            অথবা{' '}
            <button
              onClick={() => useAppStore.getState().setView('page-terms')}
              className="font-semibold text-primary hover:underline underline-offset-2"
            >
              শর্তাবলী পড়ুন
            </button>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
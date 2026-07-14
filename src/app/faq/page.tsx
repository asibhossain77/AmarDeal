import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export const metadata: Metadata = {
  title: 'ঘন ঘন জিজ্ঞাসিত প্রশ্নাবলী (FAQ)',
  description: 'AmarDeal (আমারডিল) সম্পর্কে সাধারণ প্রশ্ন ও উত্তর। এসক্রো সার্ভিস, পেমেন্ট, রিফান্ড ও লেনদেন প্রক্রিয়া সম্পর্কে জানুন। Amar Deal ব্যবহারের সম্পূর্ণ গাইড।',
  keywords: ['amardeal faq', 'আমারডিল প্রশ্ন', 'এসক্রো প্রশ্ন', 'amar deal questions', 'নিরাপদ লেনদেন FAQ'],
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: 'FAQ | AmarDeal আমারডিল',
    description: 'ঘন ঘন জিজ্ঞাসিত প্রশ্নাবলী - AmarDeal (আমারডিল)',
    url: `${SITE_URL}/faq`,
    type: 'website',
    locale: 'bn_BD',
    siteName: 'AmarDeal আমারডিল',
  },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'হোম', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${SITE_URL}/faq` },
  ],
};

const faqPageLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'এসক্রো কি?', acceptedAnswer: { '@type': 'Answer', text: 'এসক্রো (Escrow) হলো একটি নিরাপদ লেনদেন পদ্ধতি যেখানে ক্রেতার টাকা একটি তৃতীয় পক্ষের কাছে সংরক্ষণ করা হয়। আমারডিল বাংলাদেশের সেরা এসক্রো সার্ভিস।' } },
    { '@type': 'Question', name: 'আমারডিল কিভাবে কাজ করে?', acceptedAnswer: { '@type': 'Answer', text: 'ক্রেতা ডিল তৈরি করে, বিক্রেতা গ্রহণ করে, ক্রেতা পেমেন্ট করে, অ্যাডমিন ভেরিফাই করে, বিক্রেতা ডেলিভারি দেয়, ক্রেতা কনফার্ম করলে বিক্রেতাকে পেআউট যায়।' } },
    { '@type': 'Question', name: 'আমার টাকা কি নিরাপদ?', acceptedAnswer: { '@type': 'Answer', text: 'অবশ্যই! আমারডিল এন্ড-টু-এন্ড এনক্রিপশন ব্যবহার করে। টাকা ডিল সম্পন্ন না হওয়া পর্যন্ত এসক্রোতে লক থাকে।' } },
    { '@type': 'Question', name: 'পেমেন্ট কিভাবে করতে হয়?', acceptedAnswer: { '@type': 'Answer', text: 'ডিল তৈরি ও গ্রহণের পর পেমেন্ট অপশন আসবে। বিকাশ, নগদ, রকেট থেকে বেছে নিন এবং নির্দেশিত নম্বরে টাকা পাঠান।' } },
    { '@type': 'Question', name: 'রিফান্ড কিভাবে পাবো?', acceptedAnswer: { '@type': 'Answer', text: 'ডিল বাতিল হলে রিফান্ড রিকোয়েস্ট অপশন আসবে। ব্যাংক বা বিকাশ নম্বর দিলে ২৪-৪৮ ঘন্টার মধ্যে টাকা ফেরত আসবে।' } },
    { '@type': 'Question', name: 'যদি বিক্রেতা পণ্য না দেয়?', acceptedAnswer: { '@type': 'Answer', text: 'বিক্রেতা ডেলিভারি না দিলে ক্রেতা বিরোধ দায়ের করতে পারে। অ্যাডমিন উভয় পক্ষের কথা শুনে সিদ্ধান্ত নেবে। বিক্রেতা দোষী হলে পুরো টাকা ফেরত দেওয়া হবে।' } },
    { '@type': 'Question', name: 'একাউন্ট কিভাবে খুলবো?', acceptedAnswer: { '@type': 'Answer', text: 'হোম পেজ থেকে "লগইন/রেজিস্ট্রেশন" বাটনে ক্লিক করুন। নাম, ফোন নম্বর ও পাসওয়ার্ড দিয়ে বিনামূল্যে একাউন্ট খুলতে পারবেন।' } },
    { '@type': 'Question', name: 'লেনদেনের ফি কত?', acceptedAnswer: { '@type': 'Answer', text: 'ফি ডিলের পরিমাণের উপর নির্ভর করে। ছোট ডিলে ফি কম, বড় ডিলে ফি বেশি। সম্পূর্ণ স্বচ্ছভাবে দেখানো হয়।' } },
    { '@type': 'Question', name: 'পেআউট কত সময়ে পাবো?', acceptedAnswer: { '@type': 'Answer', text: 'ক্রেতা কনফার্ম করার পর সাধারণত ২৪-৪৮ ঘন্টার মধ্যে টাকা আপনার অ্যাকাউন্টে পৌঁছে যাবে।' } },
    { '@type': 'Question', name: 'ডিল বাতিল করা যায় কি?', acceptedAnswer: { '@type': 'Answer', text: 'পেমেন্ট ভেরিফিকেশনের আগে যেকোনো পক্ষ ডিল বাতিল করতে পারে। পেমেন্ট ভেরিফাইড হলে বিরোধ প্রক্রিয়ার মাধ্যমে সমাধান করতে হবে।' } },
    { '@type': 'Question', name: 'ডিল আইডি (DL-XXXXX) কিসের কাজে লাগে?', acceptedAnswer: { '@type': 'Answer', text: 'প্রতিটি ডিলে একটি ইউনিক আইডি থাকে। এটি দিয়ে নির্দিষ্ট ডিল খুঁজে পাওয়া যায় এবং সাপোর্টের সাথে যোগাযোগে দ্রুত সমাধান পাওয়া যায়।' } },
  ],
};

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd) }} />
      <AppShell initialView="page-faq" />
    </>
  );
}
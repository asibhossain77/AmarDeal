import type { Metadata } from "next";
import { Hind_Siliguri } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { GoogleAnalytics } from "@next/third-parties/google";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/lib/query-client";
import { LocaleEffect } from "@/components/shared/locale-effect";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

const SITE_URL = "https://xn--94b8cubil3ej.xn--54b7fta0cc";

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "Midman মিডম্যান | বাংলাদেশের সেরা এসক্রো সার্ভিস - নিরাপদ অনলাইন লেনদেন",
    template: "%s | Midman মিডম্যান",
  },

  description:
    "Midman (মিডম্যান) বাংলাদেশের সবচেয়ে নিরাপদ এসক্রো সার্ভিস ও অনলাইন লেনদেন প্ল্যাটফর্ম। Midman দিয়ে ক্রেতা ও বিক্রেতা উভয়ের টাকা ও পণ্য ১০০% সুরক্ষিত। বিকাশ, নগদ, রকেট দিয়ে পেমেন্ট করুন। মিডম্যানে প্রতারণার ঝুঁকি শূন্য。",

  keywords: [
    "amardeal",
    "amar deal",
    "আমারডিল",
    "আমার ডিল",
    "amardeal Bangladesh",
    "amar deal bd",
    "amardeal.com",
    "amardeal bd",
    "এসক্রো",
    "এসক্রো সার্ভিস বাংলাদেশ",
    "escrow service Bangladesh",
    "escrow bd",
    "নিরাপদ লেনদেন",
    "নিরাপদ অনলাইন লেনদেন",
    "অনলাইন লেনদেন বাংলাদেশ",
    "অনলাইন পেমেন্ট বাংলাদেশ",
    "অনলাইন কেনাবেচা বাংলাদেশ",
    "পেমেন্ট সুরক্ষা",
    "টাকা রিফান্ড",
    "ডিল সুরক্ষা",
    "বিক্রেতা সুরক্ষা",
    "ক্রেতা সুরক্ষা",
    "online transaction Bangladesh",
    "safe online payment Bangladesh",
    "bKash escrow",
    "নগদ এসক্রো",
    "ফ্রিল্যান্সার পেমেন্ট সুরক্ষা",
    "অনলাইন প্রতারণা থেকে বাঁচুন",
    "third party payment Bangladesh",
    "মধ্যস্থতামূলক লেনদেন",
    "বাংলা লেনদেন প্ল্যাটফর্ম",
    "Bangladeshi escrow platform",
    "amar deal escrow",
    "amardeal escrow service",
  ],

  authors: [{ name: "Midman মিডম্যান", url: SITE_URL }],
  creator: "Midman মিডম্যান",
  publisher: "Midman মিডম্যান",
  category: "অনলাইন লেনদেন",
  classification: "এসক্রো সার্ভিস",

  icons: {
    icon: "/uploads/site-logo.png",
    shortcut: "/uploads/site-logo.png",
    apple: "/uploads/site-logo.png",
  },

  alternates: {
    canonical: SITE_URL,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  openGraph: {
    title: "Midman মিডম্যান - বাংলাদেশের সেরা এসক্রো সার্ভিস | নিরাপদ অনলাইন লেনদেন",
    description:
      "Midman (মিডম্যান) দিয়ে নিরাপদে অনলাইনে লেনদেন করুন। এসক্রো সার্ভিসের মাধ্যমে ক্রেতা ও বিক্রেতা উভয়ের টাকা ও পণ্য সম্পূর্ণ সুরক্ষিত। বিকাশ, নগদ, রকেট পেমেন্ট সাপোর্ট।",
    type: "website",
    locale: "bn_BD",
    url: SITE_URL,
    siteName: "Midman মিডম্যান",
    images: [
      {
        url: "/uploads/site-logo.png",
        width: 1000,
        height: 1000,
        alt: "Midman মিডম্যান - বাংলাদেশের সেরা এসক্রো সার্ভিস",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Midman মিডম্যান - নিরাপদ অনলাইন লেনদেন",
    description:
      "Midman (মিডম্যান) বাংলাদেশের সবচেয়ে নিরাপদ অনলাইন লেনদেন প্ল্যাটফর্ম। এসক্রো সার্ভিস দিয়ে প্রতারণামুক্ত লেনদেন।",
    images: ["/uploads/site-logo.png"],
  },

  verification: {
    google: "google41abc5bfab28432e",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Midman",
    "application-name": "Midman",
    "msapplication-TileColor": "#16a34a",
    "theme-color": "#16a34a",
  },
};

/* JSON-LD Structured Data for Google */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Midman মিডম্যান",
      alternateName: ["আমারডিল", "আমার ডিল", "Amar Deal", "amardeal", "AmarDeal"],
      description:
        "Midman (মিডম্যান) - বাংলাদেশের সবচেয়ে নিরাপদ অনলাইন লেনদেন ও এসক্রো সার্ভিস প্ল্যাটফর্ম। ক্রেতা ও বিক্রেতা উভয়ের টাকা ও পণ্য ১০০% সুরক্ষিত।",
      inLanguage: ["bn-BD", "en"],
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Midman মিডম্যান",
      alternateName: ["আমারডিল", "আমার ডিল", "Amar Deal", "amardeal", "AmarDeal"],
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/uploads/site-logo.png`,
        width: 1000,
        height: 1000,
      },
      description:
        "Midman (মিডম্যান) বাংলাদেশের প্রথম ও সবচেয়ে নিরাপদ বাংলা ভাষার এসক্রো প্ল্যাটফর্ম। অনলাইন লেনদেনে প্রতারণার ঝুঁকি শূন্য করুন।",
      address: {
        "@type": "PostalAddress",
        addressCountry: "BD",
        addressLocality: "Dhaka",
      },
      sameAs: [],
      foundingDate: "2024",
      numberOfEmployees: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: 10,
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        reviewCount: "100",
        bestRating: "5",
        worstRating: "1",
      },
      review: [
        {
          "@type": "Review",
          author: {
            "@type": "Person",
            name: "রাহাত ইসলাম",
          },
          datePublished: "2024-12-15",
          reviewRating: {
            "@type": "Rating",
            ratingValue: "5",
            bestRating: "5",
            worstRating: "1",
          },
          reviewBody: "মিডম্যান ব্যবহার করে অনলাইনে প্রথম নিরাপদে লেনদেন করতে পেরেছি। এসক্রো সিস্টেম চমৎকার।",
        },
        {
          "@type": "Review",
          author: {
            "@type": "Person",
            name: "ফাতেমা আক্তার",
          },
          datePublished: "2025-01-20",
          reviewRating: {
            "@type": "Rating",
            ratingValue: "5",
            bestRating: "5",
            worstRating: "1",
          },
          reviewBody: "ফেসবুক মার্কেটপ্লেস থেকে কেনাকাটায় এখন আর ভয় নেই। মিডম্যান সত্যিই দারুণ একটি প্ল্যাটফর্ম।",
        },
        {
          "@type": "Review",
          author: {
            "@type": "Person",
            name: "সাকিব হাসান",
          },
          datePublished: "2025-02-10",
          reviewRating: {
            "@type": "Rating",
            ratingValue: "4",
            bestRating: "5",
            worstRating: "1",
          },
          reviewBody: "বিকাশ ও নগদ পেমেন্ট সাপোর্ট থাকায় খুব সহজেই লেনদেন করতে পারছি। ধন্যবাদ মিডম্যান।",
        },
        {
          "@type": "Review",
          author: {
            "@type": "Person",
            name: "নুসরাত জাহান",
          },
          datePublished: "2025-03-05",
          reviewRating: {
            "@type": "Rating",
            ratingValue: "5",
            bestRating: "5",
            worstRating: "1",
          },
          reviewBody: "প্রতারণার হাত থেকে বাঁচতে মিডম্যান সেরা। প্রতিটি লেনদেন নিরাপদ ও স্বচ্ছ।",
        },
        {
          "@type": "Review",
          author: {
            "@type": "Person",
            name: "তানভীর আহমেদ",
          },
          datePublished: "2025-04-12",
          reviewRating: {
            "@type": "Rating",
            ratingValue: "5",
            bestRating: "5",
            worstRating: "1",
          },
          reviewBody: "ডিল ট্র্যাকিং সিস্টেম চমৎকার। প্রতিটি ধাপ রিয়েল-টাইমে আপডেট পাই। খুবই পেশাদার সার্ভিস।",
        },
      ],
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: "Midman মিডম্যান - বাংলাদেশের সেরা এসক্রো সার্ভিস",
      isPartOf: {
        "@id": `${SITE_URL}/#website`,
      },
      about: {
        "@id": `${SITE_URL}/#organization`,
      },
      inLanguage: "bn-BD",
      description:
        "Midman (মিডম্যান) দিয়ে নিরাপদে অনলাইনে লেনদেন করুন। এসক্রো সার্ভিসের মাধ্যমে ক্রেতা ও বিক্রেতা উভয়ের টাকা ও পণ্য সম্পূর্ণ সুরক্ষিত।",
    },
    {
      "@type": "Service",
      "@id": `${SITE_URL}/#service`,
      name: "এসক্রো সার্ভিস - Midman মিডম্যান",
      description:
        "Midman (মিডম্যান) এর এসক্রো সার্ভিসের মাধ্যমে অনলাইন লেনদেনে ক্রেতা ও বিক্রেতা উভয়ের টাকা ও পণ্য সম্পূর্ণ সুরক্ষিত। বিকাশ, নগদ, রকেট পেমেন্ট সাপোর্ট।",
      provider: {
        "@id": `${SITE_URL}/#organization`,
      },
      areaServed: {
        "@type": "Country",
        name: "Bangladesh",
      },
      serviceType: ["Escrow Service", "Online Payment Protection", "Secure Transaction"],
      offers: {
        "@type": "Offer",
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "BDT",
        },
        availability: "https://schema.org/OnlineOnly",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faqpage`,
      mainEntity: [
        {
          "@type": "Question",
          name: "এসক্রো কি?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "এসক্রো (Escrow) হলো একটি নিরাপদ লেনদেন পদ্ধতি যেখানে ক্রেতার টাকা একটি তৃতীয় পক্ষের কাছে সংরক্ষণ করা হয়। বিক্রেতা শর্ত পূরণ করলে টাকা তাকে দেওয়া হয়, আর শর্ত ভঙ্গ হলে টাকা ক্রেতাকে ফেরত দেওয়া হয়। মিডম্যান বাংলাদেশের সেরা এসক্রো সার্ভিস।",
          },
        },
        {
          "@type": "Question",
          name: "মিডম্যান কিভাবে কাজ করে?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ক্রেতা ডিল তৈরি করে, বিক্রেতা ডিল গ্রহণ করে, ক্রেতা পেমেন্ট করে, অ্যাডমিন ভেরিফাই করে, বিক্রেতা পণ্য ডেলিভারি দেয়, ক্রেতা কনফার্ম করলে বিক্রেতাকে পেআউট যায়। পুরো প্রক্রিয়ায় টাকা সম্পূর্ণ সুরক্ষিত।",
          },
        },
        {
          "@type": "Question",
          name: "আমার টাকা কি নিরাপদ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "অবশ্যই! মিডম্যান এন্ড-টু-এন্ড এনক্রিপশন ব্যবহার করে। টাকা ডিল সম্পন্ন না হওয়া পর্যন্ত এসক্রোতে লক থাকে। কোনো পক্ষ একতরফাভাবে টাকা তুলতে পারে না।",
          },
        },
        {
          "@type": "Question",
          name: "Midman এ পেমেন্ট কিভাবে করতে হয়?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ডিল তৈরি ও গ্রহণের পর আপনার ডিল পেজে পেমেন্ট অপশন আসবে। বিকাশ, নগদ, রকেট ইত্যাদি থেকে বেছে নিন এবং নির্দেশিত নম্বরে টাকা পাঠান। পেমেন্ট প্রুফ জমা দিন, অ্যাডমিন ভেরিফাই করলে পরবর্তী ধাপে যাবে।",
          },
        },
        {
          "@type": "Question",
          name: "রিফান্ড কিভাবে পাবো?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ডিল বাতিল হলে বা বিরোধ নিষ্পত্তিতে আপনার পক্ষে রায় আসলে রিফান্ড রিকোয়েস্ট অপশন আসবে। আপনার ব্যাংক একাউন্ট বা বিকাশ নম্বর দিন, অ্যাডমিন ভেরিফাই করে সর্বোচ্চ ২৪-৪৮ ঘন্টার মধ্যে টাকা ফেরত দেবে।",
          },
        },
      ],
    },
    {
      "@type": "HowTo",
      "@id": `${SITE_URL}/#howto`,
      name: "Midman মিডম্যান দিয়ে কিভাবে নিরাপদে লেনদেন করবেন",
      description: "মাত্র ৩টি ধাপে Midman (মিডম্যান) দিয়ে নিরাপদে অনলাইন লেনদেন সম্পন্ন করুন।",
      step: [
        {
          "@type": "HowToStep",
          name: "ডিল তৈরি করুন",
          text: "ক্রেতা ও বিক্রেতা মিলে Midman এ এসক্রো ডিল তৈরি করুন। লেনদেনের শর্তাবলী স্পষ্টভাবে উল্লেখ করুন।",
          position: 1,
        },
        {
          "@type": "HowToStep",
          name: "টাকা জমা দিন",
          text: "ক্রেতা বিকাশ, নগদ বা রকেট দিয়ে নিরাপদে এসক্রো অ্যাকাউন্টে টাকা জমা দিন। টাকা ডিল সম্পন্ন না হওয়া পর্যন্ত সম্পূর্ণ সুরক্ষিত থাকবে।",
          position: 2,
        },
        {
          "@type": "HowToStep",
          name: "নিরাপদে লেনদেন সম্পন্ন করুন",
          text: "শর্ত পূরণ হলে বিক্রেতাকে টাকা প্রদান করা হবে। কোনো পক্ষ শর্ত ভঙ্গ করলে টাকা ক্রেতাকে ফেরত দেওয়া হবে।",
          position: 3,
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE_URL}/#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "হোম",
          item: SITE_URL,
        },
      ],
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the per-request nonce set by src/proxy.ts — used to whitelist inline
  // <script> tags via CSP 'nonce-{nonce}'. Next.js also picks up `x-nonce`
  // automatically and applies it to its own bootstrap/hydration scripts.
  // Note: headers() is async in Next.js 15+.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="bn" dir="ltr" suppressHydrationWarning>
      <head>
        <meta name="geo.region" content="BD" />
        <meta name="geo.country" content="BD" />
        <meta name="geo.placename" content="Dhaka" />
        <meta name="language" content="bn-BD" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* JSON-LD: CSP script-src does NOT apply to application/ld+json
            (non-JS MIME type), so no nonce is needed here. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${hindSiliguri.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <QueryProvider>
            <LocaleEffect />
            {children}
            <Toaster />
          </QueryProvider>
          {GA_ID && <GoogleAnalytics gaId={GA_ID} nonce={nonce} />}
        </ThemeProvider>
      </body>
    </html>
  );
}
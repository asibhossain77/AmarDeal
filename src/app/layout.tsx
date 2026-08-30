import type { Metadata } from "next";
import { Hind_Siliguri } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { GoogleAnalytics } from "@next/third-parties/google";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/lib/query-client";
import { LocaleEffect } from "@/components/shared/locale-effect";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

const SITE_URL = "https://midman.bd";
const FALLBACK_LOGO = "/logo.svg";

async function getSiteLogo(): Promise<string> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'site_logo' } });
    if (row?.value && row.value !== '/logo.png' && !row.value.startsWith('data:')) return row.value;
  } catch { /* fallback */ }
  return FALLBACK_LOGO;
}

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const logo = await getSiteLogo();
  return {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Midman মিডম্যান | বাংলাদেশের সেরা এসক্রো সার্ভিস - নিরাপদ অনলাইন লেনদেন",
    template: "%s | Midman মিডম্যান",
  },

  description:
    "Midman (মিডম্যান) বাংলাদেশের সবচেয়ে নিরাপদ এসক্রো সার্ভিস ও অনলাইন লেনদেন প্ল্যাটফর্ম। Midman দিয়ে ক্রেতা ও বিক্রেতা উভয়ের টাকা ও পণ্য ১০০% সুরক্ষিত। বিকাশ, নগদ, রকেট দিয়ে পেমেন্ট করুন। মিডম্যানে প্রতারণার ঝুঁকি শূন্য。",

  keywords: [
    "midman",
    "midman.bd",
    "মিডম্যান",
    "মিডম্যান বাংলাদেশ",
    "midman Bangladesh",
    "midman bd",
    "escrow",
    "escrow bd",
    "escrow Bangladesh",
    "escrow service",
    "escrow service Bangladesh",
    "escrow service bd",
    "এসক্রো",
    "এসক্রো সার্ভিস",
    "এসক্রো সার্ভিস বাংলাদেশ",
    "P2P",
    "P2P Bangladesh",
    "P2P transaction",
    "P2P payment",
    "P2P escrow",
    "P2P লেনদেন",
    "P2P পেমেন্ট বাংলাদেশ",
    "peer to peer Bangladesh",
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
    "midman escrow",
    "midman escrow service",
    "secure payment gateway Bangladesh",
    "online escrow bd",
    "escrow payment bd",
    "P2P marketplace Bangladesh",
    "buyer protection Bangladesh",
    "seller protection Bangladesh",
  ],

  authors: [{ name: "Midman মিডম্যান", url: SITE_URL }],
  creator: "Midman মিডম্যান",
  publisher: "Midman মিডম্যান",
  category: "অনলাইন লেনদেন",
  classification: "এসক্রো সার্ভিস",

  icons: {
    icon: logo,
    shortcut: logo,
    apple: logo,
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
        url: logo,
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
    images: [logo],
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
}

/* JSON-LD Structured Data for Google */
async function buildJsonLd() {
  const logo = await getSiteLogo();
  return {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Midman মিডম্যান",
      alternateName: ["মিডম্যান", "Midman", "midman.bd"],
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
      alternateName: ["মিডম্যান", "Midman", "midman.bd"],
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: logo.startsWith('http') ? logo : `${SITE_URL}${logo}`,
        width: 1000,
        height: 1000,
      },
      description:
        "Midman (মিডম্যান) বাংলাদেশের প্রথম ও সবচেয়ে নিরাপদ বাংলা ভাষার Escrow ও P2P লেনদেন প্ল্যাটফর্ম। এসক্রো সার্ভিসের মাধ্যমে অনলাইন লেনদেনে প্রতারণার ঝুঁকি শূন্য করুন।",
      address: {
        "@type": "PostalAddress",
        addressCountry: "BD",
        addressLocality: "Dhaka",
      },
      sameAs: [],
      foundingDate: "2024",
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
      name: "Escrow ও P2P লেনদেন সার্ভিস - Midman মিডম্যান",
      description:
        "Midman (মিডম্যান) বাংলাদেশের সেরা Escrow ও P2P লেনদেন প্ল্যাটফর্ম। ক্রেতা ও বিক্রেতা উভয়ের টাকা ও পণ্য এসক্রোতে সম্পূর্ণ সুরক্ষিত। bKash, Nagad, Rocket পেমেন্ট সাপোর্ট। Peer to peer নিরাপদ লেনদেন।",
      provider: {
        "@id": `${SITE_URL}/#organization`,
      },
      areaServed: {
        "@type": "Country",
        name: "Bangladesh",
      },
      serviceType: [
        "Escrow Service",
        "Escrow BD",
        "P2P Transaction",
        "P2P Payment",
        "Online Payment Protection",
        "Secure Transaction",
        "Third Party Payment",
        "Buyer Protection",
        "Seller Protection",
      ],
      offers: {
        "@type": "Offer",
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "BDT",
        },
        availability: "https://schema.org/OnlineOnly",
      },
    },
  ],
};
}

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
        {/* Resource hints — preconnect to 3rd-party origins for faster fetch */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {GA_ID && <link rel="preconnect" href="https://www.googletagmanager.com" />}
        <meta name="geo.region" content="BD" />
        <meta name="geo.country" content="BD" />
        <meta name="geo.placename" content="Dhaka" />
        <meta name="language" content="bn-BD" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* JSON-LD: CSP script-src does NOT apply to application/ld+json
            (non-JS MIME type), so no nonce is needed here. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(await buildJsonLd()) }}
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
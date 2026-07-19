'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  ArrowLeft,
  ExternalLink,
  Loader2,
  User,
} from 'lucide-react';

/* ─── Types ─── */
interface ContactData {
  name: string;
  photoUrl: string;
  address: string;
  phone: string;
  email: string;
  facebookUrl: string;
  whatsappUrl: string;
  instagramUrl: string;
  websiteUrl: string;
}

/* ─── Social Links Config ─── */
interface SocialLink {
  label: string;
  url: string;
  color: string;
  hoverBg: string;
}

function getSocialLinks(data: ContactData): SocialLink[] {
  const links: SocialLink[] = [];
  if (data.facebookUrl)
    links.push({ label: 'ফেসবুক', url: data.facebookUrl, color: '#1877F2', hoverBg: 'bg-[#1877F2]/10' });
  if (data.whatsappUrl)
    links.push({ label: 'হোয়াটসঅ্যাপ', url: data.whatsappUrl, color: '#25D366', hoverBg: 'bg-[#25D366]/10' });
  if (data.instagramUrl)
    links.push({ label: 'ইনস্টাগ্রাম', url: data.instagramUrl, color: '#E4405F', hoverBg: 'bg-[#E4405F]/10' });
  if (data.websiteUrl)
    links.push({ label: 'ওয়েবসাইট', url: data.websiteUrl, color: '#65A30D', hoverBg: 'bg-primary/10' });
  return links;
}

/* ─── Animation Variants ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/* ═══════════════════════════════════════════
   Contact Page Client
   ═══════════════════════════════════════════ */
export function ContactPageClient() {
  const [data, setData] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/contact-info');
        if (res.ok) {
          const info = await res.json();
          setData(info);
        }
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  /* ─── No Data State ─── */
  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4 text-center">
        <p className="text-lg font-semibold text-foreground mb-2">তথ্য পাওয়া যায়নি</p>
        <p className="text-sm text-muted-foreground mb-6">এই মুহূর্তে যোগাযোগ তথ্য উপলব্ধ নেই</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
        >
          <ArrowLeft className="h-4 w-4" />
          হোমপেজে ফিরুন
        </Link>
      </div>
    );
  }

  const socialLinks = getSocialLinks(data);
  const hasAnyInfo =
    data.name || data.address || data.phone || data.email || socialLinks.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* ── Header ── */}
      <header className="bg-white dark:bg-zinc-900 border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            ফিরুন
          </Link>
          <Link href="/" className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
              <span className="text-xs font-bold leading-none text-primary-foreground">আ</span>
            </div>
            <span className="text-sm font-bold text-foreground">আমার ডিল</span>
          </Link>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {!hasAnyInfo ? (
          /* Empty state */
          <div className="text-center py-16">
            <p className="text-lg font-semibold text-foreground mb-2">তথ্য পাওয়া যায়নি</p>
            <p className="text-sm text-muted-foreground">এই মুহূর্তে যোগাযোগ তথ্য উপলব্ধ নেই</p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* ── Profile Card ── */}
            {(data.name || data.photoUrl) && (
              <motion.div
                variants={itemVariants}
                className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl shadow-gray-300/50 dark:shadow-black/20 p-6 sm:p-8 text-center"
              >
                {/* Avatar */}
                {data.photoUrl ? (
                  <img
                    src={data.photoUrl}
                    alt={data.name || 'Profile'}
                    className="mx-auto h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-primary/20 shadow-lg mb-4"
                    loading="lazy" decoding="async"
                  />
                ) : (
                  <div className="mx-auto h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-primary/15 flex items-center justify-center mb-4 shadow-lg">
                    <User className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
                  </div>
                )}
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  {data.name || 'আমার ডিল'}
                </h1>
              </motion.div>
            )}

            {/* ── Contact Details ── */}
            <motion.div
              variants={itemVariants}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl shadow-gray-300/50 dark:shadow-black/20 p-5 sm:p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-foreground">যোগাযোগের তথ্য</h2>

              {data.address && (
                <ContactRow icon={MapPin} label="ঠিকানা" value={data.address} />
              )}
              {data.phone && (
                <ContactRow icon={Phone} label="ফোন নম্বর" value={data.phone} />
              )}
              {data.email && (
                <ContactRow icon={Mail} label="ইমেইল" value={data.email} />
              )}

              {!data.address && !data.phone && !data.email && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  যোগাযোগ তথ্য শীঘ্রই যোগ করা হবে
                </p>
              )}
            </motion.div>

            {/* ── Social Links ── */}
            {socialLinks.length > 0 && (
              <motion.div
                variants={itemVariants}
                className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl shadow-gray-300/50 dark:shadow-black/20 p-5 sm:p-6"
              >
                <h2 className="text-base font-bold text-foreground mb-4">সোশ্যাল মিডিয়া</h2>
                <div className="grid grid-cols-2 gap-3">
                  {socialLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 rounded-2xl p-3.5 border border-border/50 transition-all hover:shadow-md active:scale-[0.98] ${link.hoverBg}`}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${link.color}20` }}
                      >
                        <Globe className="h-4 w-4" style={{ color: link.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate">
                          {link.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          দেখতে ক্লিক করুন
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Footer: Return to Homepage Button ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 sm:mt-10 pb-6 text-center"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 h-12 px-8 rounded-2xl bg-foreground dark:bg-white text-white dark:text-zinc-900 font-bold text-sm shadow-xl hover:shadow-2xl transition-shadow active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            হোমপেজে ফিরুন
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} আমার ডিল — নিরাপদ অনলাইন লেনদেন
          </p>
        </motion.div>
      </main>
    </div>
  );
}

/* ─── Contact Row Component ─── */
function ContactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3.5 rounded-2xl bg-muted/40 p-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm font-bold text-foreground mt-0.5 break-words">
          {value}
        </p>
      </div>
    </div>
  );
}
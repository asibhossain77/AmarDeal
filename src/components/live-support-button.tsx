'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Phone, Mail, HelpCircle, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface ContactInfo {
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  telegram: string | null;
  facebook: string | null;
}

const FALLBACK_CONTACT: ContactInfo = {
  phone: null,
  email: null,
  whatsapp: null,
  telegram: null,
  facebook: null,
};

function formatWhatsAppLink(number: string): string {
  const digits = number.replace(/\D/g, '');
  const full = digits.startsWith('880') ? digits : `880${digits}`;
  return `https://wa.me/${full}`;
}

function formatPhoneLink(number: string): string {
  const digits = number.replace(/\D/g, '');
  const full = digits.startsWith('+') ? digits : `+${digits}`;
  return `tel:${full}`;
}

export function LiveSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [contact, setContact] = useState<ContactInfo>(FALLBACK_CONTACT);
  const [loaded, setLoaded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    fetch('/api/contact-info')
      .then((r) => (r.ok ? r.json() : FALLBACK_CONTACT))
      .catch(() => FALLBACK_CONTACT)
      .then((data) => {
        setContact(data);
        setLoaded(true);
      });
  }, []);

  // Auto-hide button after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) setIsHidden(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // When panel opens, unhide; when closes, re-hide after delay
  useEffect(() => {
    if (isOpen) {
      setIsHidden(false);
    } else {
      const timer = setTimeout(() => setIsHidden(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const hasContact = contact.whatsapp || contact.phone || contact.email;

  return (
    <div
      className="fixed bottom-6 right-0 z-50 flex flex-col items-end gap-3 pr-3"
      onMouseEnter={() => !isOpen && setIsHidden(false)}
    >
      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-80 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-primary-foreground font-semibold text-sm">লাইভ সাপোর্ট</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary-foreground/60 animate-pulse" />
                    <p className="text-primary-foreground/80 text-xs">অনলাইনে আছি</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4 text-primary-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {/* Greeting */}
              <div className="bg-primary/5 dark:bg-primary/10 rounded-xl px-4 py-3">
                <p className="text-sm text-foreground leading-relaxed">
                  আসসালামু আলাইকুম! 👋
                  <br />
                  আমারডিল এ স্বাগতম। কিভাবে সাহায্য করতে পারি?
                </p>
              </div>

              {/* Contact Options */}
              {hasContact && (
                <div className="space-y-2">
                  {contact.whatsapp && (
                    <a
                      href={formatWhatsAppLink(contact.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors group"
                    >
                      <div className="h-9 w-9 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">WhatsApp এ মেসেজ করুন</p>
                        <p className="text-xs text-muted-foreground truncate">{contact.whatsapp}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </a>
                  )}

                  {contact.phone && (
                    <a
                      href={formatPhoneLink(contact.phone)}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors group"
                    >
                      <div className="h-9 w-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                        <Phone className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">কল করুন</p>
                        <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </a>
                  )}

                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors group"
                    >
                      <div className="h-9 w-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
                        <Mail className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">ইমেইল করুন</p>
                        <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </a>
                  )}
                </div>
              )}

              {!hasContact && !loaded && (
                <div className="flex items-center justify-center py-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}

              {/* Quick Links */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground px-1 mb-2">দ্রুত সাহায্য</p>
                <QuickLink icon={<HelpCircle className="h-4 w-4" />} label="ঘন ঘন জিজ্ঞাসিত প্রশ্ন" view="page-faq" onClose={() => setIsOpen(false)} />
                <QuickLink icon={<MessageCircle className="h-4 w-4" />} label="যোগাযোগ পৃষ্ঠা" view="page-contact" onClose={() => setIsOpen(false)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button — Square with curved corners, auto-hides to right */}
      <motion.button
        animate={{
          x: isHidden && !isOpen ? 52 : 0,
          opacity: isHidden && !isOpen ? 0.7 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-12 rounded-2xl bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 shadow-lg shadow-primary/30 dark:shadow-primary/20 flex items-center justify-center transition-colors relative cursor-pointer"
        aria-label={isOpen ? 'সাপোর্ট প্যানেল বন্ধ করুন' : 'লাইভ সাপোর্ট'}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5 text-primary-foreground" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="h-5 w-5 text-primary-foreground" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse ring animation */}
        {!isOpen && !isHidden && (
          <span className="absolute inset-0 rounded-2xl bg-primary animate-ping opacity-20" />
        )}
      </motion.button>
    </div>
  );
}

/* ── Quick link that navigates via Zustand ── */
function QuickLink({
  icon,
  label,
  view,
  onClose,
}: {
  icon: React.ReactNode;
  label: string;
  view: 'page-faq' | 'page-contact';
  onClose: () => void;
}) {
  const setView = useAppStore((s) => s.setView);

  const handleClick = useCallback(() => {
    setView(view);
    onClose();
  }, [setView, view, onClose]);

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left group"
    >
      <span className="text-muted-foreground group-hover:text-foreground transition-colors">{icon}</span>
      <span className="text-sm text-foreground">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
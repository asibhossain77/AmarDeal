'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize';

interface PopupData {
  enabled: boolean;
  content: string;
  image: string;
  link: string;
  buttonTitle: string;
}

const STORAGE_KEY = 'midman-popup-dismissed';

export function SitePopup() {
  const [data, setData] = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    fetch('/api/popup')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((res) => {
        if (res?.enabled && (res.content || res.image)) {
          setData(res);
          // Small delay so the page loads first
          setTimeout(() => setVisible(true), 800);
        }
      });
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(STORAGE_KEY, '1');
  };

  return (
    <AnimatePresence>
      {visible && data && (
        <>
          {/* Backdrop */}
          <motion.div
            key="popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-[2px]"
            onClick={dismiss}
          />
          {/* Popup Card */}
          <motion.div
            key="popup-card"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed inset-0 z-[9991] flex items-center justify-center p-4 pointer-events-none"
            onClick={dismiss}
          >
            <div
              className="w-full max-w-[400px] rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Bar */}
              <div className="bg-primary px-5 py-3 flex items-center justify-between shrink-0">
                <span className="text-white font-semibold text-sm">ঘোষণা</span>
                <button
                  onClick={dismiss}
                  className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  aria-label="বন্ধ করুন"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
                {data.image && (
                  <img
                    src={data.image}
                    alt=""
                    className="w-full rounded-xl object-contain max-h-[180px]"
                  />
                )}
                {data.content && (
                  <div
                    className="text-sm text-foreground"
                    style={{ lineHeight: '1.7' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.content) }}
                  />
                )}
                {data.link && (
                  <a
                    href={data.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    {data.buttonTitle || 'বিস্তারিত দেখুন'}
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

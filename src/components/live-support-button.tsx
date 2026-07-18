'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, HelpCircle, ChevronRight, Send } from 'lucide-react';
import { useAppStore } from '@/lib/store';

/** Bell-shake keyframes — decaying oscillation like a ringing bell */
const bellShakeSequence = [0, -14, 12, -10, 8, -5, 3, 0];

export function LiveSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isNudging, setIsNudging] = useState(false);
  const hoverLockRef = useRef(false);

  // Auto-hide button after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) setIsHidden(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // When panel opens, unhide and cancel nudge; when closes, re-hide after delay
  useEffect(() => {
    if (isOpen) {
      setIsHidden(false);
      setIsNudging(false);
    } else {
      const timer = setTimeout(() => setIsHidden(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Periodic nudge: first peek after 8s, then every 15s with bell shake
  useEffect(() => {
    if (!isHidden || isOpen || isNudging || hoverLockRef.current) return;

    const trigger = () => {
      if (!hoverLockRef.current && !isOpen) setIsNudging(true);
    };

    const firstTimer = setTimeout(trigger, 8000);
    const interval = setInterval(trigger, 15000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [isHidden, isOpen, isNudging]);

  // Nudge duration: shake for ~3s then hide again
  useEffect(() => {
    if (!isNudging) return;

    const timer = setTimeout(() => {
      setIsNudging(false);
    }, 3500);

    return () => clearTimeout(timer);
  }, [isNudging]);

  // Hover: reveal button and lock nudge while hovered
  const handleMouseEnter = useCallback(() => {
    hoverLockRef.current = true;
    if (!isOpen) {
      setIsHidden(false);
      setIsNudging(false);
    }
  }, [isOpen]);

  const handleMouseLeave = useCallback(() => {
    hoverLockRef.current = false;
    if (!isOpen) {
      const timer = setTimeout(() => setIsHidden(true), 1000);
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

  // Button slide state
  const shouldSlideOut = isHidden && !isOpen && !isNudging;

  return (
    <div
      className="fixed bottom-6 right-0 z-50 flex flex-col items-end gap-3 pr-3"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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

              {/* Quick Links */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground px-1 mb-2">দ্রুত সাহায্য</p>
                <QuickLink icon={<HelpCircle className="h-4 w-4" />} label="ঘন ঘন জিজ্ঞাসিত প্রশ্ন" view="page-faq" onClose={() => setIsOpen(false)} />
                <QuickLink icon={<Send className="h-4 w-4" />} label="যোগাযোগ পৃষ্ঠা" view="page-contact" onClose={() => setIsOpen(false)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        animate={{
          x: shouldSlideOut ? 52 : 0,
          opacity: shouldSlideOut ? 0.4 : 1,
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-12 rounded-2xl bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 shadow-lg shadow-primary/30 dark:shadow-primary/20 flex items-center justify-center transition-colors relative cursor-pointer shrink-0"
        aria-label={isOpen ? 'সাপোর্ট প্যানেল বন্ধ করুন' : 'লাইভ সাপোর্ট'}
      >
        {/* Icon with bell-shake during nudge */}
        <motion.div
          animate={
            isNudging
              ? { rotate: bellShakeSequence }
              : { rotate: 0 }
          }
          transition={
            isNudging
              ? { duration: 1.6, ease: 'easeInOut', delay: 0.5, repeat: 1 }
              : { duration: 0.2 }
          }
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
        </motion.div>

        {/* Pulse ring — only when visible, closed, not nudging */}
        {!isOpen && !isHidden && !isNudging && (
          <motion.span
            initial={{ scale: 1, opacity: 0.25 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-2xl bg-primary"
          />
        )}

        {/* Nudge glow — soft glow during bell shake */}
        <AnimatePresence>
          {isNudging && (
            <motion.span
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: 1.6, opacity: 0.3 }}
              exit={{ scale: 1, opacity: 0 }}
              transition={{ duration: 0.8, repeat: 3, repeatType: 'reverse', ease: 'easeInOut' }}
              className="absolute inset-0 rounded-2xl bg-primary"
            />
          )}
        </AnimatePresence>
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
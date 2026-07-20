'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, Mail, HelpCircle, ChevronRight, Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface ContactInfo {
  whatsapp: string | null;
  telegramGroup: string | null;
  facebookGroup: string | null;
  email: string | null;
}

const FALLBACK_CONTACT: ContactInfo = {
  whatsapp: null,
  telegramGroup: null,
  facebookGroup: null,
  email: null,
};

function formatWhatsAppLink(number: string): string {
  const digits = number.replace(/\D/g, '');
  const full = digits.startsWith('880') ? digits : `880${digits}`;
  return `https://wa.me/${full}`;
}

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function LiveSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [contact, setContact] = useState<ContactInfo>(FALLBACK_CONTACT);

  // AI Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sessionId] = useState(() => `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChatted = messages.length > 0;

  useEffect(() => {
    fetch('/api/contact-info')
      .then((r) => (r.ok ? r.json() : FALLBACK_CONTACT))
      .catch(() => FALLBACK_CONTACT)
      .then((data) => setContact(data));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const sendAiMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || aiLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages(prev => [...prev, { role: 'ai', text: data.error }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: data.response }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'সংযোগে সমস্যা। আবার চেষ্টা করুন।' }]);
    } finally {
      setAiLoading(false);
    }
  }, [input, aiLoading, sessionId]);

  // Collect available contact links
  const contactLinks: { href: string; icon: React.ElementType; label: string; gradient: string }[] = [];
  if (contact.whatsapp) contactLinks.push({ href: formatWhatsAppLink(contact.whatsapp), icon: WhatsAppIcon, label: 'WhatsApp', gradient: 'from-green-500/20 to-emerald-500/10 hover:from-green-500/30 hover:to-emerald-500/20' });
  if (contact.email) contactLinks.push({ href: `mailto:${contact.email}`, icon: Mail, label: 'Email', gradient: 'from-orange-500/20 to-amber-500/10 hover:from-orange-500/30 hover:to-amber-500/20' });
  if (contact.telegramGroup) contactLinks.push({ href: contact.telegramGroup, icon: TelegramIcon, label: 'Telegram', gradient: 'from-cyan-500/20 to-sky-500/10 hover:from-cyan-500/30 hover:to-sky-500/20' });
  if (contact.facebookGroup) contactLinks.push({ href: contact.facebookGroup, icon: FacebookIcon, label: 'Facebook', gradient: 'from-blue-500/20 to-indigo-500/10 hover:from-blue-500/30 hover:to-indigo-500/20' });

  return (
    <div className="fixed bottom-6 right-0 z-50 flex flex-col items-end gap-3 pr-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="w-[340px] sm:w-[380px] rounded-2xl overflow-hidden flex flex-col ai-panel-border"
            style={{ maxHeight: 'min(580px, calc(100vh - 100px))' }}
          >
            {/* Header — dark AI gradient */}
            <div className="relative px-5 py-4 shrink-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />
              {/* Subtle dot grid pattern */}
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-zinc-900" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-[15px] tracking-tight">AI সাপোর্ট</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                      </span>
                      <p className="text-white/50 text-[11px] font-medium">সরাসরি উত্তর দিচ্ছে</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                  aria-label="বন্ধ করুন"
                >
                  <X className="h-4 w-4 text-white/70" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 ai-chat-bg">
              {/* Welcome + Contact Grid — shown when no chat messages yet */}
              {!hasChatted && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Welcome message */}
                  <div className="flex gap-2.5 max-w-[90%]">
                    <div className="shrink-0 mt-1">
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-cyan-400/20 flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-fuchsia-500" />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-800/80 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-zinc-100 dark:border-zinc-700/50">
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        আসসালামু আলাইকুম! 👋
                        {'\n'}আমারডিল এ স্বাগতম। আমি AI অ্যাসিস্ট্যান্ট। কিভাবে সাহায্য করতে পারি?
                      </p>
                    </div>
                  </div>

                  {/* 2×2 Contact Grid — glassmorphism */}
                  {contactLinks.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {contactLinks.map((link, idx) => {
                        const Icon = link.icon;
                        return (
                          <motion.a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + idx * 0.06 }}
                            className={`relative flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-gradient-to-br ${link.gradient} border border-zinc-200/60 dark:border-zinc-700/40 backdrop-blur-sm transition-all duration-200 group hover:scale-[1.02] hover:shadow-sm active:scale-[0.98]`}
                          >
                            <Icon className="h-5 w-5 text-foreground/60 group-hover:text-foreground shrink-0 transition-colors" />
                            <span className="text-[12.5px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors">{link.label}</span>
                          </motion.a>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Chat Messages */}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'ai' && (
                    <div className="shrink-0 mt-1 mr-2">
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-cyan-400/20 flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-fuchsia-500" />
                      </div>
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md'
                        : 'bg-white dark:bg-zinc-800/80 text-foreground rounded-bl-md border border-zinc-100 dark:border-zinc-700/50'
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {/* AI Thinking Indicator */}
              {aiLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="shrink-0 mt-1 mr-2">
                    <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-cyan-400/20 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-fuchsia-500 animate-pulse" />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-800/80 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-zinc-100 dark:border-zinc-700/50">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-[3px]">
                        <span className="h-[5px] w-[5px] bg-fuchsia-500/70 rounded-sm animate-[thinkBounce_1.4s_ease-in-out_infinite]" />
                        <span className="h-[5px] w-[5px] bg-fuchsia-400/70 rounded-sm animate-[thinkBounce_1.4s_ease-in-out_0.2s_infinite]" />
                        <span className="h-[5px] w-[5px] bg-cyan-400/70 rounded-sm animate-[thinkBounce_1.4s_ease-in-out_0.4s_infinite]" />
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium ml-1">চিন্তা করছি...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* AI Text Input Bar */}
            <div className="p-3 pt-2 ai-input-bg shrink-0">
              <form
                onSubmit={(e) => { e.preventDefault(); sendAiMessage(); }}
                className="flex items-center gap-2"
              >
                <div className={`flex-1 rounded-[12px] p-[2px] ai-glow-border ${aiLoading ? 'ai-glow-loading' : ''}`}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="আপনার প্রশ্ন লিখুন..."
                    disabled={aiLoading}
                    className="w-full h-[38px] px-4 rounded-[10px] bg-white dark:bg-zinc-900 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 transition-opacity"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || aiLoading}
                  className="h-[42px] w-10 rounded-[12px] bg-gradient-to-br from-fuchsia-500 to-cyan-400 hover:from-fuchsia-600 hover:to-cyan-500 disabled:opacity-40 disabled:from-fuchsia-500 disabled:to-cyan-400 flex items-center justify-center transition-all shrink-0 shadow-md shadow-fuchsia-500/15 hover:shadow-lg hover:shadow-fuchsia-500/25 active:scale-95"
                  aria-label="মেসেজ পাঠান"
                >
                  {aiLoading ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 text-white" />
                  )}
                </button>
              </form>

              {/* FAQ & Contact Links */}
              <div className="flex gap-1.5 mt-2.5">
                <button
                  onClick={() => { useAppStore.getState().setView('page-faq'); setIsOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-muted-foreground hover:text-foreground group"
                >
                  <HelpCircle className="h-3 w-3 group-hover:text-fuchsia-500 transition-colors" />
                  <span className="text-[11px] font-medium">FAQ</span>
                </button>
                <button
                  onClick={() => { useAppStore.getState().setView('page-contact'); setIsOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-muted-foreground hover:text-foreground group"
                >
                  <ChevronRight className="h-3 w-3 group-hover:text-cyan-500 transition-colors" />
                  <span className="text-[11px] font-medium">যোগাযোগ</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <div className="relative">
        {/* Pulse ring */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-2xl bg-primary animate-ping opacity-20" />
        )}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(!isOpen)}
          className="relative h-13 w-13 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 hover:from-fuchsia-600 hover:to-cyan-500 shadow-xl shadow-fuchsia-500/25 flex items-center justify-center transition-all cursor-pointer shrink-0"
          aria-label={isOpen ? 'সাপোর্ট প্যানেল বন্ধ করুন' : 'সাপোর্ট'}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="h-5 w-5 text-white" />
              </motion.div>
            ) : (
              <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <MessageCircle className="h-5 w-5 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
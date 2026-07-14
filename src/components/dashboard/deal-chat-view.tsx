'use client';

import { useState, useRef, useEffect, useSyncExternalStore, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  Bot,
  ShieldCheck,
  Loader2,
  MessageSquare,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Phone,
  Hash,
  CircleCheck,
} from 'lucide-react';
import { AccessDenied } from '@/components/shared/access-denied';

const emptySubscribe = () => () => {};

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface ChatMsg {
  id: string;
  dealId: string;
  role: string;
  senderName: string;
  text: string;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('bn-BD', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'আজ';
  if (d.toDateString() === yesterday.toDateString()) return 'গতকাল';
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shouldShowDateSeparator(messages: ChatMsg[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].createdAt).toDateString();
  const curr = new Date(messages[index].createdAt).toDateString();
  return prev !== curr;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'created':
      return <Badge className="bg-slate-100 text-slate-700 border-0 font-medium text-[10px]">তৈরি হয়েছে</Badge>;
    case 'Pending_Verification':
      return <Badge className="bg-amber-100 text-amber-700 border-0 font-medium text-[10px]">ভেরিফিকেশন পেন্ডিং</Badge>;
    case 'Pending_Payment':
      return <Badge className="bg-orange-100 text-orange-700 border-0 font-medium text-[10px]">পেমেন্ট ফেরত</Badge>;
    case 'Payment_Verified':
      return <Badge className="bg-blue-100 text-blue-700 border-0 font-medium text-[10px]">ভেরিফাইড</Badge>;
    case 'in_delivery':
      return <Badge className="bg-primary/15 text-primary border-0 font-medium text-[10px]">ডেলিভারি চলছে</Badge>;
    case 'completed':
      return <Badge className="bg-emerald-100 text-emerald-700 border-0 font-medium text-[10px]">সম্পন্ন</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-700 border-0 font-medium text-[10px]">রিজেক্টেড</Badge>;
    case 'disputed':
      return <Badge className="bg-red-100 text-red-700 border-0 font-medium text-[10px]">বিরোধ</Badge>;
    case 'cancelled':
      return <Badge className="bg-zinc-100 text-zinc-600 border-0 font-medium text-[10px]">বাতিল</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

/* ═══════════════════════════════════════════════════════════
   Date Separator
   ═══════════════════════════════════════════════════════════ */

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 max-w-[80px] bg-border/60" />
        <span className="text-[11px] font-medium text-muted-foreground/70">{date}</span>
        <div className="h-px flex-1 max-w-[80px] bg-border/60" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Message Bubble Components
   ═══════════════════════════════════════════════════════════ */

/** System message — centered, muted, with Bot icon */
function SystemBubble({ msg }: { msg: ChatMsg }) {
  return (
    <div className="flex justify-center py-1 px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-start gap-2.5 max-w-[85%] sm:max-w-[70%]"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col items-start">
          <div className="rounded-2xl rounded-tl-md bg-muted/60 border border-border/40 px-4 py-2.5">
            <p className="text-[13px] leading-relaxed text-foreground/80">{msg.text}</p>
          </div>
          <span className="mt-1 text-[10px] text-muted-foreground/50 ml-1">
            {formatTime(msg.createdAt)}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/** Admin message — centered, visually distinct card with shield */
function AdminBubble({ msg }: { msg: ChatMsg }) {
  return (
    <div className="flex justify-center py-1 px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center max-w-[85%] sm:max-w-[70%]"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-500/15">
            <ShieldCheck className="h-3 w-3 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 tracking-wide uppercase">
            Admin
          </span>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-500/8 dark:to-violet-500/8 border border-purple-200/60 dark:border-purple-500/20 px-5 py-3 shadow-sm shadow-purple-100/40 dark:shadow-none">
          <p className="text-[13px] leading-relaxed text-purple-900 dark:text-purple-200 text-center">
            {msg.text}
          </p>
        </div>
        <span className="mt-1.5 text-[10px] text-muted-foreground/50">
          {formatTime(msg.createdAt)}
        </span>
      </motion.div>
    </div>
  );
}

/** Buyer/Seller chat bubble — aligned left or right */
function ChatBubble({
  msg,
  isOwn,
  showAvatar,
  showName,
  avatarColor,
}: {
  msg: ChatMsg;
  isOwn: boolean;
  showAvatar: boolean;
  showName: boolean;
  avatarColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, x: isOwn ? 12 : -12 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex gap-2.5 px-4 py-1 ${isOwn ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        {showAvatar && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {msg.senderName?.charAt(0) || '?'}
          </div>
        )}
      </div>

      {/* Bubble + meta */}
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[60%]`}>
        {/* Sender name */}
        {showName && (
          <span className={`text-[10px] font-semibold mb-1 px-1 ${
            isOwn ? 'text-primary/80' : 'text-muted-foreground'
          }`}>
            {msg.senderName}
          </span>
        )}

        {/* Bubble */}
        <div
          className={`relative px-4 py-2.5 shadow-sm ${
            isOwn
              ? 'rounded-2xl rounded-tr-md text-white'
              : 'rounded-2xl rounded-tl-md bg-white dark:bg-zinc-800 border border-border/50 text-foreground'
          }`}
          style={isOwn ? { backgroundColor: '#65A30D' } : undefined}
        >
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
        </div>

        {/* Time + check */}
        <div className={`flex items-center gap-1 mt-1 px-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-muted-foreground/50">{formatTime(msg.createdAt)}</span>
          {isOwn && <CircleCheck className="h-3 w-3 text-primary/50" />}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Typing Indicator
   ═══════════════════════════════════════════════════════════ */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/80">
        <span className="text-[10px] font-bold text-muted-foreground">?</span>
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-muted/60 border border-border/40 px-4 py-3">
        <span className="flex h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="flex h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="flex h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════════════ */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/8 mb-5">
        <MessageSquare className="h-10 w-10 text-primary/40" />
      </div>
      <h3 className="text-base font-bold text-foreground/80 mb-1">কোনো মেসেজ নেই</h3>
      <p className="text-xs text-muted-foreground/60 max-w-[240px] leading-relaxed">
        এই ডিলে এখনো কোনো মেসেজ আদানপ্রদান হয়নি। নিচে টাইপ করে শুরু করুন।
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

export function DealChatView() {
  const { setDashboardPanel, activeDeal, user } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitialLoad = useRef(true);

  /* ── Fetch messages ── */
  const fetchMessages = useCallback(async () => {
    if (!activeDeal?.id) return;
    setLoading(true);
    setAccessDenied(false);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`);
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.ok) {
        const data: ChatMsg[] = await res.json();
        setMessages(data);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [activeDeal?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;
    if (isInitialLoad.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      isInitialLoad.current = false;
    } else {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* ── Focus input on mount ── */
  useEffect(() => {
    if (mounted && !loading) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [mounted, loading]);

  /* ── Send message ── */
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !activeDeal?.id || sending) return;

    setSending(true);
    setInputText('');

    // Determine role
    const isBuyer = user?.id === activeDeal.buyerId;
    const role = isBuyer ? 'buyer' : 'seller';
    const senderName = user?.name || 'ব্যবহারকারী';

    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, senderName, text }),
      });

      if (res.ok) {
        const newMsg: ChatMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'মেসেজ পাঠাতে সমস্যা হয়েছে');
        setInputText(text); // Restore text on failure
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
      setInputText(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  /* ── Keyboard handler ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!mounted) return null;

  if (accessDenied) return <AccessDenied />;

  const dealTitle = activeDeal?.title || 'ডিল';
  const dealStatus = activeDeal?.status || 'created';
  const dealAmount = activeDeal?.amount ?? 0;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* ═══════════════════════════════════════
          CHAT HEADER
          ═══════════════════════════════════════ */}
      <div className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-xl px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => setDashboardPanel('deal-detail')}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-accent"
            aria-label="ফিরে যান"
          >
            <ArrowLeft className="h-4.5 w-4.5 text-foreground" />
          </button>

          {/* Deal avatar */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
            style={{ backgroundColor: '#65A30D' }}
          >
            {dealTitle.charAt(0)}
          </div>

          {/* Deal info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground truncate">{dealTitle}</h2>
              {getStatusBadge(dealStatus)}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground">
                DL-{(activeDeal?.id || '').slice(-5)}
              </span>
              <span className="text-[11px] text-muted-foreground/40">•</span>
              <span className="text-[11px] font-semibold" style={{ color: '#65A30D' }}>
                ৳{dealAmount.toLocaleString('bn-BD')}
              </span>
            </div>
          </div>

          {/* Online indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                সক্রিয়
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          CHAT MESSAGES AREA
          ═══════════════════════════════════════ */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--border) 0.5px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="py-4">
            {messages.map((msg, i) => {
              /* Date separator */
              if (shouldShowDateSeparator(messages, i)) {
                return (
                  <div key={`date-${i}`}>
                    <DateSeparator date={formatDate(msg.createdAt)} />
                    <MessageRenderer
                      msg={msg}
                      index={i}
                      messages={messages}
                      userId={user?.id}
                      buyerId={activeDeal?.buyerId}
                      sellerId={activeDeal?.sellerId}
                    />
                  </div>
                );
              }
              return (
                <MessageRenderer
                  key={msg.id}
                  msg={msg}
                  index={i}
                  messages={messages}
                  userId={user?.id}
                  buyerId={activeDeal?.buyerId}
                  sellerId={activeDeal?.sellerId}
                />
              );
            })}

            {/* Typing indicator when sending */}
            {sending && <TypingIndicator />}

            {/* Scroll anchor */}
            <div className="h-2" />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          INPUT BAR (fixed at bottom)
          ═══════════════════════════════════════ */}
      <div className="shrink-0 border-t border-border/60 bg-background/90 backdrop-blur-xl px-4 py-3 sm:px-5">
        <div className="flex items-end gap-2.5 max-w-3xl mx-auto">
          {/* Attachment button (visual placeholder) */}
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="ফাইল সংযুক্ত করুন"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="মেসেজ লিখুন..."
              disabled={sending}
              className="h-10 rounded-xl border-border/60 bg-muted/40 pr-10 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-primary/30"
            />
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              aria-label="ইমোজি"
            >
              <Smile className="h-4 w-4" />
            </button>
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="h-10 w-10 shrink-0 rounded-xl p-0 shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
            style={{
              backgroundColor: inputText.trim() ? '#65A30D' : 'var(--muted)',
              color: inputText.trim() ? '#ffffff' : 'var(--muted-foreground)',
              boxShadow: inputText.trim() ? '0 4px 14px rgba(101,163,13,0.35)' : 'none',
            }}
            aria-label="পাঠান"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Keyboard spacer hint for mobile */}
        <p className="text-center text-[10px] text-muted-foreground/30 mt-1.5 hidden sm:block">
          Enter চেপে পাঠান
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Message Router (decides which bubble to render)
   ═══════════════════════════════════════════════════════════ */

function MessageRenderer({
  msg,
  index,
  messages,
  userId,
  buyerId,
  sellerId,
}: {
  msg: ChatMsg;
  index: number;
  messages: ChatMsg[];
  userId?: string;
  buyerId?: string;
  sellerId?: string;
}) {
  /* System messages */
  if (msg.role === 'system') {
    return <SystemBubble key={msg.id} msg={msg} />;
  }

  /* Admin messages — centered, special styling */
  if (msg.role === 'admin') {
    return <AdminBubble key={msg.id} msg={msg} />;
  }

  /* Buyer/Seller — determine own vs other */
  const isBuyer = msg.role === 'buyer';
  const isOwn =
    (isBuyer && userId === buyerId) ||
    (msg.role === 'seller' && userId === sellerId);

  /* Show avatar/name when it's the first message from this sender in a group */
  const prevMsg = index > 0 ? messages[index - 1] : null;
  const isSameSender = prevMsg && prevMsg.role === msg.role && prevMsg.senderName === msg.senderName;
  const prevIsSystem = prevMsg?.role === 'system' || prevMsg?.role === 'admin';
  const showAvatar = !isSameSender || !!prevIsSystem;
  const showName = showAvatar && !isOwn;

  /* Avatar color based on role */
  const avatarColor = isBuyer
    ? '#65A30D' // parrot green for buyer
    : '#3B82F6'; // blue for seller

  return (
    <ChatBubble
      msg={msg}
      isOwn={isOwn}
      showAvatar={showAvatar}
      showName={showName}
      avatarColor={avatarColor}
    />
  );
}
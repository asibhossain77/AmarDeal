'use client';

/**
 * Deal Details page — redesigned (premium fintech UI)
 *
 * Layout:
 *  - Header: back to deal list · Midman brand · 3 tabs (Deal তথ্য / চ্যাট / Deal Terms)
 *  - Deal তথ্য: title + status, 5-step tracker, amount card, payment & actions
 *    (all backend-driven), buyer/seller cards, activity timeline, collapsible terms
 *  - চ্যাট: dedicated immersive chat (polling, attachments, admin call)
 *  - Deal Terms: full terms with safe auto-linked URLs
 *  - Mobile: sticky bottom action bar (primary action + chat shortcut)
 *  - Desktop: two-column layout (main info + profiles/summary sidebar)
 *
 * ALL original behaviour is preserved, including the latest upstream features:
 * chat file attachments (R2 + 3-day auto-delete), seller work-duration commitment
 * + buyer countdown, unresponsive-buyer auto-complete flow (reminder + warning),
 * digital product download page, and pool-based seller withdrawals.
 *
 * Scroll contract (matches upstream fixes): on mobile the panel grows with its
 * content and the PAGE scrolls (no ghost inner scroller); sm+ inner-scrolls under
 * a max-height cap. The chat tab always uses a fixed viewport height.
 */

import { useState, useRef, useEffect, useSyncExternalStore, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingAnimation } from '@/components/shared/loading-animation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cdnUrl } from '@/lib/cdn-url';
import { useSiteSettings } from '@/lib/use-site-settings';
import { WorkDeadlineSelector, WorkDeadlineCountdown } from './work-deadline';
import { DeliveryReminderCard, AutoCompleteWarning } from './auto-complete';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Check,
  Clock,
  Copy,
  FileDown,
  FileText,
  Headphones,
  Info,
  MessageCircle,
  PackageCheck,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  SendHorizonal,
  ThumbsUp,
  Truck,
  Wallet,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  PipraPayButton,
  PaymentDialog,
  PayoutRefundDialog,
} from './deal-detail/dialogs';
import {
  type DealData,
  type ChatMessage,
  type ChatFileMeta,
  dbToChatMsg,
  formatDealDate,
  statusToActiveStep,
  StatusBadge,
  DealStepper,
  DealAmountCard,
  PartyCards,
  DealSummaryCard,
  ActivityTimeline,
  TermsPreviewCard,
  TermsFullView,
  TermsEmptyState,
  NoticeBanner,
  PayoutInfoBox,
  PaymentSubmittedInfo,
  ChatBubble,
  ChatDateDivider,
  ChatEmptyState,
  DealDetailSkeleton,
  formatChatDayLabel,
  CHAT_FILE_ACCEPT,
  CHAT_FILE_MAX_BYTES,
  ChatFileIcon,
  formatFileSize,
} from './deal-detail/parts';

const emptySubscribe = () => () => {};

type DealTab = 'info' | 'chat' | 'terms';

/* ═══════════════════════════════════════════════════════════
   Main Exported Component
   ═══════════════════════════════════════════════════════════ */

export function DealWorkflowTracker() {
  const activeDeal = useAppStore((s) => s.activeDeal);
  const user = useAppStore((s) => s.user);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const { siteName, siteLogo } = useSiteSettings();

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<DealTab>('info');
  const activeTabRef = useRef<DealTab>('info');

  /* ── Deal data from DB ── */
  const [dealData, setDealData] = useState<DealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [disputeLoading, setDisputeLoading] = useState(false);

  /* ── Chat state ── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [adminCallLoading, setAdminCallLoading] = useState(false);
  /* ── Chat file attachment state ── */
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFile, setPendingFile] = useState<(ChatFileMeta & { key: string }) | null>(null);
  const [chatFileError, setChatFileError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMsgCountRef = useRef(0);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  /* ── Payout status state ── */
  const [payoutSubmitted, setPayoutSubmitted] = useState(false);
  const [payoutPaid, setPayoutPaid] = useState(false);
  const [payoutChecking, setPayoutChecking] = useState(true);
  const [submittedPayoutInfo, setSubmittedPayoutInfo] = useState<{ accountType: string; accountNumber: string; accountName: string } | null>(null);

  /* ── Dialog state ── */
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'dispute' | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  /* ── Derived state ── */
  const status = dealData?.status || activeDeal?.status || 'created';
  const activeStep = statusToActiveStep(status);
  const isDisputed = status === 'disputed';
  const isCancelled = status === 'cancelled' || status === 'rejected';
  const isCompleted = status === 'completed';
  const userId = user?.id;
  const isBuyer = userId === (dealData?.buyerId || activeDeal?.buyerId) || (userId === activeDeal?.buyerId);
  const isSeller = userId === (dealData?.sellerId) || userId === activeDeal?.sellerId || (!isBuyer && user?.isSeller);

  /* ── Check if payout already submitted for current deal ── */
  const checkPayoutStatus = useCallback((showLoading = false) => {
    if (!dealData?.id || !userId) return;
    const currentStatus = dealData?.status || activeDeal?.status || 'created';
    const currentIsCompleted = currentStatus === 'completed';
    const currentIsCancelled = currentStatus === 'cancelled' || currentStatus === 'rejected';
    const currentIsBuyer = userId === (dealData?.buyerId || activeDeal?.buyerId) || userId === activeDeal?.buyerId;
    const currentIsSeller = userId === dealData?.sellerId || userId === activeDeal?.sellerId || (!currentIsBuyer && user?.isSeller);
    // No refund for rejected deals (admin rejected = wrong/invalid transaction)
    // Only cancelled deals allow buyer refund
    const noRefund = currentStatus === 'rejected';
    const checkType = currentIsCompleted && currentIsSeller ? 'seller_payout' : (currentStatus === 'cancelled' && currentIsBuyer && !noRefund) ? 'buyer_refund' : null;
    if (!checkType) {
      setPayoutChecking(false);
      return;
    }
    if (showLoading) setPayoutChecking(true);
    fetch('/api/user/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((payouts: { dealId: string; type: string; status: string; accountType: string; accountNumber: string; accountName: string }[]) => {
        const match = payouts.find((p) => p.dealId === dealData!.id && p.type === checkType);
        // Only update states if we found a match — never reset submitted/paid back to false
        // (prevents polling API hiccups from showing the form again)
        if (match) {
          setPayoutSubmitted(true);
          setPayoutPaid(match.status === 'paid');
          setSubmittedPayoutInfo({ accountType: match.accountType, accountNumber: match.accountNumber, accountName: match.accountName });
        }
      })
      .catch(() => {})
      .finally(() => setPayoutChecking(false));
  }, [dealData?.id, userId, dealData?.status, activeDeal?.buyerId, activeDeal?.sellerId, dealData?.buyerId, dealData?.sellerId, user?.isSeller]);

  // Initial check with loading skeleton
  useEffect(() => {
    checkPayoutStatus(true);
  }, [checkPayoutStatus]);

  /* ── Fetch deal from DB ── */
  const fetchDeal = useCallback(async () => {
    if (!activeDeal?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}`);
      if (res.ok) {
        const data: DealData = await res.json();
        setDealData(data);
        setLoadError(false);

        if (data.status !== activeDeal.status) {
          useAppStore.getState().setActiveDeal({
            id: data.id,
            title: data.title,
            amount: data.amount,
            status: data.status,
            createdAt: data.createdAt,
            buyerId: data.buyerId,
            sellerId: data.sellerId || undefined,
            creatorId: data.creatorId,
            buyerName: data.buyer?.name,
            sellerName: data.seller?.name,
            rejectionReason: data.rejectionReason,
          });
        }
      } else {
        setLoadError(true);
      }
    } catch {
      // Use store data as fallback
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeDeal?.id, activeDeal?.status]);

  useEffect(() => {
    fetchDeal();
  }, [fetchDeal]);

  /* Auto-scroll chat — only if user is near bottom */
  const isNearBottomRef = useRef(true);

  const handleChatScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    // Consider "near bottom" if within 80px of the bottom
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  /* No auto-scroll on incoming messages — only on user send */

  /* Mark messages as seen when user opens chat tab */
  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'chat') {
      setHasUnreadChat(false);
      lastMsgCountRef.current = messages.length;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeTab, messages.length]);

  /* ── Auth headers for API calls ── */
  const authHeaders = useCallback(() => ({
    'X-User-Id': user?.id || '',
  }), [user?.id]);

  /* ── Fetch chat messages from API ── */
  const fetchMessages = useCallback(async () => {
    if (!activeDeal?.id) return;
    setChatLoading(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data: Array<{ id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string; file?: ChatFileMeta | null; fileExpired?: boolean }> = await res.json();
        const mapped = data.map(dbToChatMsg);
        setMessages(mapped);
        setChatError(false);
        // Initial load — mark all as seen
        lastMsgCountRef.current = mapped.length;
        setHasUnreadChat(false);
      }
    } catch {
      setChatError(true);
    } finally {
      setChatLoading(false);
    }
  }, [activeDeal?.id, authHeaders]);

  /* ── Polling: chat every 3s, deal + payout every ~9s ── */
  useEffect(() => {
    if (!activeDeal?.id) return;

    fetchMessages();

    let pollCount = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data: Array<{ id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string; file?: ChatFileMeta | null; fileExpired?: boolean }> = await res.json();
          const mapped = data.map(dbToChatMsg);
          setMessages(mapped);

          // Detect unread: new messages from others while NOT on the chat tab
          const prevCount = lastMsgCountRef.current;
          if (mapped.length > prevCount && activeTabRef.current !== 'chat') {
            const newMsgs = mapped.slice(prevCount);
            const hasOtherMsg = newMsgs.some((m) => m.senderId !== user?.id);
            if (hasOtherMsg) setHasUnreadChat(true);
          }
          // Keep ref in sync
          if (activeTabRef.current === 'chat') {
            lastMsgCountRef.current = mapped.length;
          } else if (prevCount === 0) {
            lastMsgCountRef.current = mapped.length;
          }
        }
      } catch {
        // silent - will retry on next interval
      }

      // Refresh deal data + payout status every ~9 seconds (every 3rd poll)
      pollCount++;
      if (pollCount % 3 === 0) {
        try {
          const dealRes = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}`);
          if (dealRes.ok) {
            const data: DealData = await dealRes.json();
            setDealData((prev) => {
              if (!prev) return data;
              // Update entire deal data if anything changed (admin edits, payment amount, status, etc.)
              const changed =
                prev.status !== data.status ||
                prev.adminCalled !== data.adminCalled ||
                prev.paymentAmount !== data.paymentAmount ||
                prev.platformFee !== data.platformFee ||
                prev.workDays !== data.workDays ||
                prev.workDeadlineAt !== data.workDeadlineAt ||
                prev.deliveredAt !== data.deliveredAt ||
                prev.reminderEmailSentAt !== data.reminderEmailSentAt ||
                prev.autoCompleteAt !== data.autoCompleteAt ||
                prev.rejectionReason !== data.rejectionReason;
              return changed ? data : prev;
            });
          }
        } catch {
          // silent
        }
        // Re-check payout status to detect admin mark-paid
        checkPayoutStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeDeal?.id, fetchMessages, authHeaders, checkPayoutStatus]);

  /* Mobile: the panel grows with content and the PAGE scrolls — entering from the
     deals list must start at the top, not at the list's scroll offset.
     (Must stay above the early returns — unconditional hook.) */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeDeal?.id]);

  /* ── Deal field fallbacks ── */
  const dealId = dealData?.id || activeDeal?.id || '';
  const dealTitle = dealData?.title || activeDeal?.title || 'ডিল';
  const dealDate = formatDealDate(dealData?.createdAt || activeDeal?.createdAt);
  const buyerName = dealData?.buyer?.name || activeDeal?.buyerName || user?.name || 'ক্রেতা';
  const sellerName = dealData?.seller?.name || activeDeal?.sellerName || 'বিক্রেতা';
  const counterpartyImage = isBuyer ? dealData?.seller?.imageLink : dealData?.buyer?.imageLink;
  const dealTerms = dealData?.terms;

  /* ── Action handlers (preserved 1:1) ── */
  const handleDeliver = async () => {
    if (!dealData) return;
    setDeliverLoading(true);
    try {
      const res = await fetch('/api/deals/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: dealData.id }),
      });
      if (res.ok) {
        toast.success('কাজ সম্পন্ন হিসেবে চিহ্নিত হয়েছে! ক্রেতাকে জানানো হচ্ছে।');
        fetchDeal();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setDeliverLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!dealData) return;
    setCancelLoading(true);
    setConfirmAction(null);
    try {
      const res = await fetch('/api/deals/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: dealData.id }),
      });
      if (res.ok) {
        toast.success('ডিলটি বাতিল করা হয়েছে');
        fetchDeal();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'বাতিল করতে সমস্যা');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!dealData) return;
    setAcceptLoading(true);
    try {
      const res = await fetch('/api/deals/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: dealData.id }),
      });
      if (res.ok) {
        toast.success('পণ্য/সেবা গ্রহণ নিশ্চিত করা হয়েছে! ডিল সম্পন্ন।');
        fetchDeal();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'নিশ্চিত করতে সমস্যা');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setAcceptLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!dealData) return;
    setDisputeLoading(true);
    setConfirmAction(null);
    try {
      const res = await fetch('/api/deals/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: dealData.id }),
      });
      if (res.ok) {
        toast.error('বিরোধ দায়ের করা হয়েছে। অ্যাডমিন পর্যালোচনা করবেন।');
        fetchDeal();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'বিরোধ দায়েরে সমস্যা');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setDisputeLoading(false);
    }
  };

  /** Upload a chat attachment — file is stored in R2 and auto-deleted after 3 days */
  const handleChatFileSelect = async (f: File) => {
    if (!activeDeal?.id) return;
    setChatFileError('');
    if (f.size > CHAT_FILE_MAX_BYTES) {
      setChatFileError('ফাইল সর্বোচ্চ 4MB হতে পারবে');
      return;
    }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat/upload`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPendingFile({ key: data.key, fileName: data.fileName, fileSize: data.fileSize, fileType: data.fileType });
      } else {
        setChatFileError(data.error || 'ফাইল আপলোড করতে সমস্যা হয়েছে');
      }
    } catch {
      setChatFileError('নেটওয়ার্ক সমস্যা — ফাইল আপলোড হয়নি');
    } finally {
      setUploadingFile(false);
      if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    }
  };

  /** Send chat message via API (text and/or attachment) */
  const handleSend = async () => {
    const trimmed = chatInput.trim();
    if ((!trimmed && !pendingFile) || !activeDeal?.id || !user?.id) return;
    setSendingMsg(true);
    try {
      const role = isBuyer ? 'buyer' : 'seller';
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          role,
          senderName: user.name || 'আপনি',
          text: trimmed || undefined,
          file: pendingFile
            ? { key: pendingFile.key, fileName: pendingFile.fileName, fileSize: pendingFile.fileSize, fileType: pendingFile.fileType }
            : undefined,
        }),
      });
      if (res.ok) {
        setChatInput('');
        setPendingFile(null);
        setChatFileError('');
        // Immediately fetch messages so the sent message appears without waiting for poll
        const msgRes = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
          headers: authHeaders(),
        });
        if (msgRes.ok) {
          const data: Array<{ id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string; file?: ChatFileMeta | null; fileExpired?: boolean }> = await msgRes.json();
          setMessages(data.map(dbToChatMsg));
          if (isNearBottomRef.current) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'মেসেজ পাঠাতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setSendingMsg(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  /* ── Call Admin ── */
  const handleCallAdmin = async () => {
    if (!activeDeal?.id || adminCallLoading) return;
    setAdminCallLoading(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/call-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': user?.id || '' },
      });
      if (res.ok) {
        setDealData((prev) => prev ? { ...prev, adminCalled: true } : prev);
        // Re-fetch messages so the system message appears
        const msgRes = await fetch(`/api/deals/${encodeURIComponent(activeDeal.id)}/chat`, {
          headers: authHeaders(),
        });
        if (msgRes.ok) {
          const data: Array<{ id: string; role: string | null; senderName: string | null; text: string; createdAt: string; senderId: string }> = await msgRes.json();
          setMessages(data.map(dbToChatMsg));
        }
        toast.success('অ্যাডমিনকে ডাকা হয়েছে!');
      } else {
        toast.error('অ্যাডমিন ডাকতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setAdminCallLoading(false);
    }
  };

  /* ── Copy deal ID ── */
  const handleCopyId = () => {
    if (!dealId) return;
    navigator.clipboard.writeText('DL-' + dealId.slice(-5)).then(() => {
      setCopiedId(true);
      toast.success('Deal ID কপি হয়েছে');
      setTimeout(() => setCopiedId(false), 2000);
    }).catch(() => {
      toast.error('কপি করা যায়নি');
    });
  };

  /* ── Chat day grouping ── */
  const groupedMessages = useMemo(() => {
    const groups: { label: string; msgs: ChatMessage[] }[] = [];
    for (const m of messages) {
      const label = formatChatDayLabel(m.timestampISO) || '';
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.msgs.push(m);
      else groups.push({ label, msgs: [m] });
    }
    return groups;
  }, [messages]);

  /* ── Primary action for the mobile sticky bar ── */
  const primaryAction: { label: string; icon: React.ElementType; onClick: () => void; loading: boolean } | null = (() => {
    if (isBuyer && status === 'created') {
      return { label: 'পেমেন্ট করুন', icon: ShieldCheck, onClick: () => setPaymentDialogOpen(true), loading: false };
    }
    if (isSeller && status === 'payment_verified') {
      return { label: 'কাজ সম্পন্ন', icon: PackageCheck, onClick: handleDeliver, loading: deliverLoading };
    }
    if (isBuyer && status === 'in_delivery') {
      return { label: 'পণ্য/সার্ভিস পেয়েছি', icon: ThumbsUp, onClick: handleAccept, loading: acceptLoading };
    }
    if (isCompleted && isSeller && !payoutSubmitted && !payoutChecking) {
      return { label: 'উত্তোলন পেজে যান', icon: Banknote, onClick: () => useAppStore.getState().setDashboardPanel('seller-withdraw'), loading: false };
    }
    if (isCancelled && status === 'cancelled' && isBuyer && !payoutSubmitted && !payoutChecking) {
      return { label: 'ফেরতের অনুরোধ করুন', icon: RotateCcw, onClick: () => setPayoutDialogOpen(true), loading: false };
    }
    return null;
  })();

  if (!mounted) return null;

  /* ── Empty state: no deal selected ── */
  if (!activeDeal?.id) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-foreground">কোনো ডিল নির্বাচিত নেই</p>
          <p className="text-xs text-muted-foreground">ডিল তালিকা থেকে একটি ডিল খুলুন</p>
          <Button
            className="h-11 rounded-xl px-5 text-sm font-semibold"
            onClick={() => useAppStore.getState().setDashboardPanel('my-deals')}
          >
            ডিল তালিকায় ফিরুন
          </Button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
      RENDER
      ═══════════════════════════════════════════════════════════ */

  const goBackToList = () => {
    useAppStore.getState().setActiveDeal(null);
    useAppStore.getState().goBack();
  };

  const tabs: { key: DealTab; label: string; icon: React.ElementType; showDot?: boolean }[] = [
    { key: 'info', label: 'Deal তথ্য', icon: Info },
    { key: 'chat', label: 'চ্যাট', icon: MessageCircle, showDot: true },
    { key: 'terms', label: 'Deal Terms', icon: FileText },
  ];

  return (
    <div
      className={`w-full ${activeTab === 'chat' ? 'h-[calc(100dvh-7rem)] sm:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-9rem)]' : 'flex-1 min-h-0 sm:max-h-[calc(100dvh-7rem)] lg:max-h-[calc(100dvh-8rem)]'} flex flex-col`}
      style={{ fontFamily: 'var(--font-noto-bengali), var(--font-hind-siliguri), sans-serif' }}
    >
      {/* ═══════════ Header: back · brand · tabs ═══════════ */}
      <div className="shrink-0 rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2.5 sm:px-4">
          {/* Back */}
          <button
            onClick={goBackToList}
            className="flex h-10 items-center gap-1.5 rounded-xl px-2 text-foreground transition-colors hover:bg-accent sm:px-3"
            aria-label="ডিল তালিকায় ফিরুন"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden text-xs font-semibold md:inline">ডিল তালিকায় ফিরুন</span>
          </button>

          {/* Midman branding */}
          <div className="flex min-w-0 items-center gap-2">
            {siteLogo ? (
              <img
                src={cdnUrl(siteLogo) || ''}
                alt={siteName}
                className="h-7 w-7 shrink-0 rounded-lg object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">M</div>
            )}
            <span className="truncate text-sm font-bold tracking-tight text-foreground">{siteName}</span>
          </div>

          {/* Status badge (desktop) */}
          <div className="hidden shrink-0 md:block">
            <StatusBadge status={status} />
          </div>
        </div>

        {/* Tabs — 3 equal columns, no horizontal overflow on mobile */}
        <div className="grid grid-cols-3 border-t border-border/50" role="tablist" aria-label="ডিল সেকশন">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex h-11 items-center justify-center gap-1.5 px-1 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {tab.showDot && hasUnreadChat && (
                  <span className="absolute right-[18%] top-2.5 h-2 w-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-label="নতুন মেসেজ" />
                )}
                {isActive && (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ Load error banner (non-blocking) ═══════════ */}
      {loadError && !loading && (
        <div className="mx-1 mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5">
          <p className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ডিলের সর্বশেষ তথ্য লোড করা যায়নি — সেভ করা তথ্য দেখানো হচ্ছে
          </p>
          <button
            onClick={fetchDeal}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 transition-colors hover:bg-amber-100 dark:hover:bg-amber-500/15"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            আবার চেষ্টা করুন
          </button>
        </div>
      )}

      {/* ═══════════ TAB CONTENT ═══════════ */}
      {activeTab === 'info' && (
        <motion.div
          key="tab-info"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          /* Mobile: the PAGE is the only scroller (no ghost inner scroller —
             upstream fix); sm+ inner-scrolls under the root's max-height cap. */
          className="min-h-0 flex-1 max-sm:overflow-visible sm:overflow-y-auto sm:overscroll-contain"
        >
          <div className={`mx-auto w-full max-w-6xl p-3 sm:p-5 lg:p-6 ${primaryAction ? 'pb-24 sm:pb-6' : ''}`}>
            {loading && !dealData && !activeDeal ? (
              <DealDetailSkeleton />
            ) : (
              <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                {/* ── Main column ── */}
                <div className="min-w-0 space-y-4 sm:space-y-5">
                  {/* Title + status + meta */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <h1 className="min-w-0 flex-1 text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">
                        {dealTitle}
                      </h1>
                      <div className="md:hidden">
                        <StatusBadge status={status} />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                      <button
                        onClick={handleCopyId}
                        className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-muted/60 px-2 font-mono text-xs font-semibold text-primary transition-colors hover:bg-muted"
                        title="Deal ID কপি করুন"
                      >
                        DL-{dealId.slice(-5)}
                        {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {dealDate}
                      </span>
                    </div>
                  </div>

                  {/* 5-step progress tracker */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
                    <DealStepper activeStep={activeStep} isDisputed={isDisputed} isCancelled={isCancelled} />
                  </div>

                  {/* Seller work-duration countdown (buyer view, after verification) */}
                  {dealData?.workDays != null && dealData?.workDeadlineAt && status === 'payment_verified' && (
                    <WorkDeadlineCountdown
                      workDays={dealData.workDays}
                      workDeadlineAt={dealData.workDeadlineAt}
                    />
                  )}

                  {/* Deal amount card */}
                  <DealAmountCard deal={dealData} />

                  {/* Buyer: digital product download — payment verified & product has a file */}
                  {isBuyer && dealData?.product?.fileName && ['payment_verified', 'in_delivery', 'completed'].includes(status) && (
                    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
                      <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
                        <FileDown className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-foreground">
                            ডিজিটাল পণ্য ডাউনলোড করুন
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground" dir="ltr">
                            {dealData.product.fileName}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          const s = useAppStore.getState();
                          s.setDownloadProductId(dealData.product!.id);
                          s.setView('page-download');
                        }}
                        className="mt-3 h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-sm sm:w-auto sm:px-8"
                      >
                        <Download className="h-[18px] w-[18px]" />
                        ডাউনলোড পেজ খুলুন
                      </Button>
                    </div>
                  )}

                  {/* ── Payment information & dynamic actions (backend-driven) ── */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <Wallet className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">পেমেন্ট ও অ্যাকশন</h3>
                    </div>

                    {/* Buyer: pay (status = created) */}
                    {isBuyer && status === 'created' && (
                      <div className="space-y-3">
                        {dealData?.rejectionReason === 'wrong_info' && (
                          <NoticeBanner tone="amber" icon={AlertTriangle} title="আপনার পেমেন্ট তথ্যে ভুল পাওয়া গেছে">
                            অনুগ্রহ করে সঠিক তথ্য দিয়ে আবার পেমেন্ট করুন। পূর্বের পেমেন্টের টাকা এই কারণে রিফান্ড হবে না।
                          </NoticeBanner>
                        )}
                        <Button
                          onClick={() => setPaymentDialogOpen(true)}
                          className="h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-sm sm:w-auto sm:px-8"
                        >
                          <ShieldCheck className="h-[18px] w-[18px]" />
                          পেমেন্ট করুন
                        </Button>
                        <PipraPayButton dealId={dealData?.id} />
                        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                          পেমেন্ট করলে টাকা Midman এসক্রোতে জমা হবে এবং যাচাইয়ের পর বিক্রেতা কাজ শুরু করবেন।
                        </p>
                      </div>
                    )}

                    {/* Buyer: waiting for verification (status = payment_pending) */}
                    {isBuyer && status === 'payment_pending' && (
                      <div className="space-y-3">
                        <NoticeBanner tone="amber" icon={Clock} title="পেমেন্ট যাচাইয়ের অপেক্ষায়">
                          আপনার পেমেন্টের তথ্য জমা হয়েছে। অ্যাডমিন যাচাই করছেন — সাধারণত কয়েক মিনিট সময় লাগে।
                        </NoticeBanner>
                        <PaymentSubmittedInfo
                          methodName={dealData?.paymentMethod?.name}
                          senderNumber={dealData?.senderNumber}
                          transactionId={dealData?.transactionId}
                          paymentAmount={dealData?.paymentAmount}
                        />
                      </div>
                    )}

                    {/* Seller: waiting for payment (status = created) */}
                    {isSeller && status === 'created' && (
                      <NoticeBanner tone="amber" icon={Clock} title="ক্রেতার পেমেন্টের অপেক্ষায় আছে">
                        ক্রেতা পেমেন্ট করার পর আপনাকে জানানো হবে।
                      </NoticeBanner>
                    )}

                    {/* Buyer: payment verified */}
                    {isBuyer && status === 'payment_verified' && (
                      <NoticeBanner tone="green" icon={ShieldCheck} title="পেমেন্ট ভেরিফাইড হয়েছে">
                        আপনার টাকা Midman এসক্রোতে সুরক্ষিত আছে। বিক্রেতা কাজ সম্পন্ন করলে জানানো হবে।
                      </NoticeBanner>
                    )}

                    {/* Seller: deliver + cancel (status = payment_verified) */}
                    {isSeller && status === 'payment_verified' && (
                      <div className="space-y-3">
                        <NoticeBanner tone="green" icon={ShieldCheck} title="পেমেন্ট ভেরিফাইড — আপনি কাজ সম্পূর্ণ করুন">
                          টাকা এসক্রোতে সুরক্ষিত। কাজ শেষ করে &quot;কাজ সম্পন্ন&quot; চাপুন।
                        </NoticeBanner>
                        <WorkDeadlineSelector
                          dealId={dealData?.id || activeDeal?.id || ''}
                          workDays={dealData?.workDays}
                          workDeadlineAt={dealData?.workDeadlineAt}
                          onSet={() => fetchDeal()}
                        />
                        <div className="flex flex-col gap-2.5 sm:flex-row">
                          <Button
                            onClick={handleDeliver}
                            disabled={deliverLoading}
                            className="h-12 flex-1 gap-2 rounded-xl text-sm font-bold shadow-sm"
                          >
                            {deliverLoading ? <LoadingAnimation size="sm" /> : <PackageCheck className="h-[18px] w-[18px]" />}
                            কাজ সম্পন্ন
                          </Button>
                          <Button
                            onClick={() => setConfirmAction('cancel')}
                            disabled={cancelLoading}
                            variant="outline"
                            className="h-12 flex-1 gap-2 rounded-xl border-destructive/30 text-sm font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <XCircle className="h-[18px] w-[18px]" />
                            ক্যান্সেল করুন
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Buyer: accept + dispute (status = in_delivery) */}
                    {isBuyer && status === 'in_delivery' && (
                      <div className="space-y-3">
                        <NoticeBanner tone="green" icon={Truck} title="বিক্রেতা ডেলিভারি দিয়েছেন">
                          পণ্য/সেবা ঠিকভাবে পেয়ে থাকলে নিশ্চিত করুন। সমস্যা হলে বিরোধ দায়ের করুন।
                        </NoticeBanner>
                        {(dealData?.reminderEmailSentAt || dealData?.autoCompleteAt) && (
                          <AutoCompleteWarning
                            reminderEmailSentAt={dealData?.reminderEmailSentAt}
                            autoCompleteAt={dealData?.autoCompleteAt}
                          />
                        )}
                        <div className="flex flex-col gap-2.5 sm:flex-row">
                          <Button
                            onClick={handleAccept}
                            disabled={acceptLoading}
                            className="h-12 flex-1 gap-2 rounded-xl text-sm font-bold shadow-sm"
                          >
                            {acceptLoading ? <LoadingAnimation size="sm" /> : <ThumbsUp className="h-[18px] w-[18px]" />}
                            পণ্য/সার্ভিস পেয়েছি
                          </Button>
                          <Button
                            onClick={() => setConfirmAction('dispute')}
                            disabled={disputeLoading}
                            variant="outline"
                            className="h-12 flex-1 gap-2 rounded-xl border-destructive/30 text-sm font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <AlertTriangle className="h-[18px] w-[18px]" />
                            বিরোধ জানান
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Seller: waiting for buyer (status = in_delivery) */}
                    {isSeller && status === 'in_delivery' && (
                      <div className="space-y-3">
                        <NoticeBanner tone="green" icon={Clock} title="ক্রেতার নিশ্চিতকরণের অপেক্ষায়">
                          ক্রেতা পণ্য/সেবা গ্রহণ করলে ডিল সম্পন্ন হবে।
                        </NoticeBanner>
                        <DeliveryReminderCard
                          dealId={dealData?.id || activeDeal?.id || ''}
                          deliveredAt={dealData?.deliveredAt}
                          updatedAt={dealData?.updatedAt}
                          reminderEmailSentAt={dealData?.reminderEmailSentAt}
                          autoCompleteAt={dealData?.autoCompleteAt}
                          onUpdated={fetchDeal}
                        />
                      </div>
                    )}

                    {/* Disputed */}
                    {isDisputed && (
                      <NoticeBanner tone="red" icon={AlertTriangle} title="বিরোধ দায়ের করা হয়েছে">
                        অ্যাডমিন উভয় পক্ষের তথ্য পর্যালোচনা করে সিদ্ধান্ত জানাবেন। প্রয়োজনে চ্যাটে অ্যাডমিনকে ডাকুন।
                      </NoticeBanner>
                    )}

                    {/* Completed — seller: pool-based withdrawal */}
                    {isCompleted && isSeller && (
                      <div className="space-y-3">
                        <NoticeBanner tone="green" icon={Check} title="ডিল সফলভাবে সম্পন্ন হয়েছে!" />
                        {payoutChecking ? (
                          <div className="space-y-2.5">
                            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                            <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
                          </div>
                        ) : !payoutSubmitted ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3">
                              <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                ৳{Math.round(dealData?.paymentAmount || dealData?.amount || 0).toLocaleString('en')} আপনার উত্তোলনযোগ্য ব্যালেন্সে যোগ হয়েছে।
                              </p>
                            </div>
                            <Button
                              onClick={() => useAppStore.getState().setDashboardPanel('seller-withdraw')}
                              className="h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-sm sm:w-auto sm:px-8"
                            >
                              <Banknote className="h-[18px] w-[18px]" />
                              উত্তোলন পেজে যান
                            </Button>
                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                              সম্পন্ন হওয়া সব ডিলের টাকা একসাথে উত্তোলন করতে ড্যাশবোর্ডের &quot;উত্তোলন&quot; পেজ ব্যবহার করুন।
                            </p>
                          </div>
                        ) : payoutPaid ? (
                          <div className="space-y-3">
                            <NoticeBanner tone="green" icon={Check} title="পেআউট সম্পন্ন হয়েছে! আপনার একাউন্টে টাকা পাঠানো হয়েছে।" />
                            {submittedPayoutInfo && <PayoutInfoBox info={submittedPayoutInfo} />}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <NoticeBanner tone="amber" icon={Clock} title="পেআউট অনুরোধ জমা হয়েছে। অ্যাডমিন প্রসেসিং করছেন।" />
                            {submittedPayoutInfo && <PayoutInfoBox info={submittedPayoutInfo} />}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completed — buyer */}
                    {isCompleted && isBuyer && (
                      <NoticeBanner tone="green" icon={Check} title="ডিল সফলভাবে সম্পন্ন হয়েছে!">
                        আপনার অভিজ্ঞতা শেয়ার করতে ডিল তালিকা থেকে রিভিউ দিন।
                      </NoticeBanner>
                    )}

                    {/* Cancelled / rejected — buyer */}
                    {isCancelled && isBuyer && (
                      <div className="space-y-3">
                        <NoticeBanner
                          tone="red"
                          icon={XCircle}
                          title={status === 'rejected' ? 'পেমেন্ট রিজেক্ট হয়েছে' : 'ডিল বাতিল হয়েছে'}
                        />
                        {/* No refund for rejected deals — admin rejected = wrong/invalid transaction */}
                        {status === 'rejected' ? (
                          <NoticeBanner tone="amber" icon={AlertTriangle} title="রিফান্ড প্রযোজ্য নয়">
                            অ্যাডমিন পেমেন্ট ভেরিফিকেশন রিজেক্ট করেছেন। ভুল ট্রানজাকশনের কারণে রিফান্ড প্রযোজ্য নয়। সঠিক তথ্য দিয়ে নতুন অ্যাডমিন ডিল তৈরি করুন।
                          </NoticeBanner>
                        ) : payoutChecking ? (
                          <div className="space-y-2.5">
                            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                            <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
                          </div>
                        ) : !payoutSubmitted ? (
                          <div className="space-y-3">
                            <p className="text-xs font-medium text-muted-foreground">আপনার অর্থ ফেরত পেতে ফেরতের অনুরোধ করুন</p>
                            <Button
                              onClick={() => setPayoutDialogOpen(true)}
                              variant="outline"
                              className="h-12 w-full gap-2 rounded-xl border-destructive/30 text-sm font-bold text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:px-8"
                            >
                              <RotateCcw className="h-[18px] w-[18px]" />
                              ফেরতের অনুরোধ করুন
                            </Button>
                          </div>
                        ) : payoutPaid ? (
                          <div className="space-y-3">
                            <NoticeBanner tone="green" icon={Check} title="ফেরত সম্পন্ন হয়েছে! আপনার একাউন্টে টাকা পাঠানো হয়েছে।" />
                            {submittedPayoutInfo && <PayoutInfoBox info={submittedPayoutInfo} />}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <NoticeBanner tone="amber" icon={Clock} title="ফেরতের অনুরোধ জমা হয়েছে। অ্যাডমিন প্রসেসিং করছেন।" />
                            {submittedPayoutInfo && <PayoutInfoBox info={submittedPayoutInfo} />}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cancelled / rejected — seller */}
                    {isCancelled && isSeller && (
                      <NoticeBanner
                        tone="red"
                        icon={XCircle}
                        title={status === 'rejected' ? 'পেমেন্ট রিজেক্ট হয়েছে' : 'ডিল বাতিল হয়েছে'}
                      />
                    )}

                    {/* Fallback: viewer is neither buyer nor seller (e.g. admin preview) */}
                    {!isBuyer && !isSeller && (
                      <NoticeBanner tone="neutral" icon={Info} title="এই ডিলের কোনো পক্ষ আপনি নন">
                        ডিলের তথ্য শুধু দেখার জন্য প্রদর্শিত হচ্ছে।
                      </NoticeBanner>
                    )}
                  </div>

                  {/* Activity timeline (backend-confirmed events only) */}
                  <ActivityTimeline deal={dealData} />

                  {/* Deal Terms preview (collapsible) */}
                  {dealTerms && dealTerms.trim() && (
                    <TermsPreviewCard terms={dealTerms} onOpenFull={() => setActiveTab('terms')} />
                  )}
                </div>

                {/* ── Side column (desktop) ── */}
                <div className="min-w-0 space-y-4 sm:space-y-5">
                  <PartyCards
                    deal={dealData}
                    currentUserId={userId}
                    fallbackBuyerName={buyerName}
                    fallbackSellerName={sellerName}
                  />
                  <DealSummaryCard deal={dealData} dealId={dealId} />

                  {/* Support shortcut */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">সাপোর্ট</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                      ডিল নিয়ে সমস্যা হলে চ্যাট থেকে অ্যাডমিনকে ডাকুন — Midman টিম সাহায্য করবে।
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('chat')}
                      className="mt-3 h-11 w-full gap-2 rounded-xl text-sm font-semibold"
                    >
                      <Headphones className="h-4 w-4" />
                      চ্যাটে যান
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══════════ TAB: চ্যাট ═══════════ */}
      {activeTab === 'chat' && (
        <motion.div
          key="tab-chat"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            {/* Chat header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                {counterpartyImage ? (
                  <img
                    src={cdnUrl(counterpartyImage) || ''}
                    alt={isBuyer ? sellerName : buyerName}
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {isBuyer ? sellerName?.charAt(0) || 'ব' : buyerName?.charAt(0) || 'ক'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {isBuyer ? sellerName : buyerName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isBuyer ? 'বিক্রেতা' : 'ক্রেতা'} · ডিল চ্যাট
                  </p>
                </div>
              </div>

              {/* Admin call */}
              <button
                onClick={handleCallAdmin}
                disabled={adminCallLoading || !!dealData?.adminCalled}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45
                  bg-destructive/10 text-destructive hover:bg-destructive/15"
                aria-label="অ্যাডমিন ডাকুন"
              >
                {adminCallLoading ? <LoadingAnimation size="sm" /> : <Headphones className="h-4 w-4" />}
                <span className="hidden sm:inline">{dealData?.adminCalled ? 'ডাকা হয়েছে' : 'অ্যাডমিন ডাকুন'}</span>
                <span className="sm:hidden">{dealData?.adminCalled ? 'ডাকা হয়েছে' : 'ডাকুন'}</span>
              </button>
            </div>

            {/* Messages */}
            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-muted/30 px-3 py-3 sm:px-5"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}
            >
              {chatLoading && messages.length === 0 && (
                <div className="flex justify-center py-6">
                  <LoadingAnimation size="sm" />
                </div>
              )}

              {chatError && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2.5 py-10">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                  <p className="text-xs font-medium text-muted-foreground">মেসেজ লোড করা যায়নি</p>
                  <Button variant="outline" size="sm" onClick={fetchMessages} className="h-9 rounded-lg text-xs font-semibold">
                    <RefreshCw className="h-3.5 w-3.5" />
                    আবার চেষ্টা করুন
                  </Button>
                </div>
              )}

              {!chatLoading && !chatError && messages.length === 0 && <ChatEmptyState />}

              {groupedMessages.map((group) => (
                <div key={group.label + group.msgs[0]?.id}>
                  {group.label && <ChatDateDivider text={group.label} />}
                  {group.msgs.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} currentUserId={userId} dealId={dealData?.id || activeDeal?.id} />
                  ))}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-border/50 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-3">
              {/* Pending attachment chip + upload error */}
              {(pendingFile || chatFileError) && (
                <div className="mb-2 flex flex-col gap-1">
                  {pendingFile && (
                    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2">
                      <ChatFileIcon fileType={pendingFile.fileType} fileName={pendingFile.fileName} className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{pendingFile.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(pendingFile.fileSize)} · পাঠানোর জন্য প্রস্তুত — ৩ দিন পর স্বয়ংক্রিয় মুছে যাবে
                        </p>
                      </div>
                      <button
                        onClick={() => setPendingFile(null)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted"
                        aria-label="ফাইল বাতিল করুন"
                      >
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {chatFileError && <p className="text-xs font-medium text-red-500">{chatFileError}</p>}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="মেসেজ লিখুন..."
                  className="h-11 min-w-0 flex-1 rounded-xl border-border/50 bg-muted/40 text-sm focus-visible:ring-primary/20"
                  aria-label="মেসেজ লিখুন"
                />

                {/* File attach button (documents + images, auto-deleted after 3 days) */}
                <button
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={uploadingFile || sendingMsg}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/50 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="ফাইল পাঠান (সর্বোচ্চ 4MB)"
                  title="ফাইল পাঠান — PDF, DOC, XLS, ZIP, JPG, PNG (সর্বোচ্চ 4MB, ৩ দিন পর মুছে যাবে)"
                >
                  {uploadingFile ? <LoadingAnimation size="sm" /> : <Paperclip className="h-5 w-5" />}
                </button>
                <input
                  ref={chatFileInputRef}
                  type="file"
                  accept={CHAT_FILE_ACCEPT}
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleChatFileSelect(f); }}
                />

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={(!chatInput.trim() && !pendingFile) || sendingMsg || uploadingFile}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
                  aria-label="পাঠান"
                >
                  {sendingMsg ? <LoadingAnimation size="sm" /> : <SendHorizonal className="h-5 w-5" />}                  
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════ TAB: Deal Terms ═══════════ */}
      {activeTab === 'terms' && (
        <motion.div
          key="tab-terms"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-0 flex-1 max-sm:overflow-visible sm:overflow-y-auto sm:overscroll-contain"
        >
          <div className="mx-auto w-full max-w-3xl p-3 sm:p-5 lg:p-6">
            {dealTerms && dealTerms.trim() ? (
              <TermsFullView terms={dealTerms} />
            ) : (
              <TermsEmptyState />
            )}
          </div>
        </motion.div>
      )}

      {/* ═══════════ Mobile sticky action bar (fixed, safe-area aware) ═══════════ */}
      {activeTab !== 'chat' && primaryAction && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-card/95 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-accent"
              aria-label="চ্যাট খুলুন"
            >
              <MessageCircle className="h-5 w-5" />
              {hasUnreadChat && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
              )}
            </button>
            <Button
              onClick={primaryAction.onClick}
              disabled={primaryAction.loading}
              className="h-11 min-w-0 flex-1 gap-2 rounded-xl text-sm font-bold shadow-sm"
            >
              {primaryAction.loading ? (
                <LoadingAnimation size="sm" />
              ) : (
                (() => { const Icon = primaryAction.icon; return <Icon className="h-[18px] w-[18px] shrink-0" />; })()
              )}
              <span className="truncate">{primaryAction.label}</span>
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════ Dialogs (preserved flows) ═══════════ */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        dealId={dealData?.id}
        dealAmount={dealData?.amount}
        dealPaymentMethod={dealData?.paymentMethod}
        onSuccess={fetchDeal}
      />

      {/* Payout/Refund dialog is only used for buyer refunds now —
          seller payouts moved to the pool-based withdrawal page. */}
      {isCancelled && isBuyer && (
        <PayoutRefundDialog
          open={payoutDialogOpen}
          onOpenChange={setPayoutDialogOpen}
          dealId={dealData?.id}
          dealTitle={dealData?.title}
          dealAmount={dealData?.amount}
          dealPaymentAmount={dealData?.paymentAmount}
          dealPlatformFee={dealData?.platformFee}
          dealPaymentMethod={dealData?.paymentMethod}
          type="buyer_refund"
          onSuccess={() => checkPayoutStatus(true)}
        />
      )}

      {/* Confirmation for sensitive actions (cancel / dispute) */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(v) => { if (!v) setConfirmAction(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {confirmAction === 'cancel' ? 'ডিল বাতিল করবেন?' : 'বিরোধ দায়ের করবেন?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              {confirmAction === 'cancel'
                ? 'এই ডিলটি বাতিল করা হলে এটি আর সক্রিয় থাকবে না। ক্রেতা পেমেন্ট করে থাকলে ফেরতের প্রক্রিয়া শুরু হবে।'
                : 'বিরোধ দায়ের করলে অ্যাডমিন ডিলটি পর্যালোচনা করবেন এবং উভয় পক্ষের তথ্যের ভিত্তিতে সিদ্ধান্ত দেবেন।'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-11 rounded-xl text-sm font-semibold">না, থাকুক</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => (confirmAction === 'cancel' ? handleCancel() : handleDispute())}
              className="h-11 rounded-xl text-sm font-bold bg-destructive text-white hover:bg-destructive/90"
            >
              {confirmAction === 'cancel' ? 'হ্যাঁ, বাতিল করুন' : 'হ্যাঁ, বিরোধ দায়ের করুন'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

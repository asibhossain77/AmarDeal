'use client';

import { MessageSquare } from 'lucide-react';

/**
 * Unread indicator for deal list rows.
 * - unreadCount > 0 → red pill with the message count (chat activity unseen)
 * - else hasUpdate  → amber "new update" pill (status/payment/delivery change)
 */
export function DealUnreadBadge({
  unreadCount,
  hasUpdate,
  updateLabel,
}: {
  unreadCount: number;
  hasUpdate: boolean;
  updateLabel: string;
}) {
  if (unreadCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm shadow-red-500/30"
        title={updateLabel}
      >
        <MessageSquare className="h-2.5 w-2.5" />
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    );
  }
  if (hasUpdate) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        {updateLabel}
      </span>
    );
  }
  return null;
}

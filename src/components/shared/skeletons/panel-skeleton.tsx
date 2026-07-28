'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * SidebarSkeleton — mimics the admin/dashboard/seller sidebar layout
 * so the content area doesn't jump when the real sidebar mounts.
 */
export function SidebarSkeleton() {
  return (
    <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-64 flex-col border-r border-border/40 bg-white dark:bg-zinc-900 z-20">
      {/* Sidebar header */}
      <div className="p-4 border-b border-border/40">
        <Skeleton className="h-5 w-28" />
      </div>
      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {[1, 2, 3].map((g) => (
          <div key={g} className="space-y-2">
            <Skeleton className="mx-2 h-3 w-20" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="mx-2 h-9 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
      {/* Bottom user area */}
      <div className="p-3 border-t border-border/40">
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    </aside>
  );
}

/**
 * StatCardSkeleton — mimics a stats card (icon + label + value)
 */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 bg-white p-5 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * TableSkeleton — mimics a data table with header + rows
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      {/* Column headers */}
      <div className="grid grid-cols-4 gap-4 border-b border-border/30 px-5 py-2.5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-3.5 w-full" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-border/30">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid grid-cols-4 gap-4 px-5 py-3.5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * PanelSkeleton — full panel page skeleton (header + stats + table)
 */
export function PanelSkeleton() {
  return (
    <div className="p-5 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      {/* Table */}
      <TableSkeleton rows={5} />
    </div>
  );
}

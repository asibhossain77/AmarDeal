'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * AuthSkeleton — mimics the login/register form layout
 */
export function AuthSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Logo area */}
        <div className="text-center space-y-3">
          <Skeleton className="mx-auto h-11 w-11 rounded-xl" />
          <Skeleton className="mx-auto h-6 w-40" />
          <Skeleton className="mx-auto h-4 w-56" />
        </div>
        {/* Form card */}
        <div className="rounded-2xl border border-border/40 bg-white p-6 dark:bg-zinc-900 space-y-5">
 {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 flex-1 rounded-lg" />
          </div>
          {/* Form fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          {/* Submit button */}
          <Skeleton className="h-11 w-full rounded-xl" />
          {/* Divider */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-px flex-1" />
          </div>
          {/* Footer link */}
          <Skeleton className="mx-auto h-4 w-48" />
        </div>
      </div>
    </div>
  );
}

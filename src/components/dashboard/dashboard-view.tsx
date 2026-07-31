'use client';

import { useSyncExternalStore } from 'react';
import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardMain } from './dashboard-main';

const emptySubscribe = () => () => {};

export function DashboardView() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] min-w-0">
      <DashboardSidebar />
      <div className="flex-1 min-w-0 md:pl-64 overflow-x-hidden">
        <DashboardMain />
      </div>
    </div>
  );
}

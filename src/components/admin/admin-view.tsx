'use client';

import { useSyncExternalStore } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminMain } from './admin-main';

const emptySubscribe = () => () => {};

export function AdminView() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="flex-1 lg:pl-64">
        <AdminMain />
      </div>
    </div>
  );
}
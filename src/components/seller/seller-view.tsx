'use client';

import { useSyncExternalStore } from 'react';
import { SellerSidebar } from './seller-sidebar';
import { SellerMain } from './seller-main';

const emptySubscribe = () => () => {};

export function SellerView() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <SellerSidebar />
      <div className="flex-1 lg:pl-64">
        <SellerMain />
      </div>
    </div>
  );
}
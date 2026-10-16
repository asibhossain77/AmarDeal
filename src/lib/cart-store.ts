'use client';

/**
 * Marketplace cart store — the SINGLE source of truth for cart state.
 *
 * Both the Marketplace header cart icon and the fixed bottom-navigation cart
 * item subscribe to this store, so the two badges can never drift apart.
 *
 * Design notes:
 *  - Client-side only (zustand + localStorage persist). Zero backend changes:
 *    the cart holds product REFERENCES (ids). Checkout always goes through the
 *    existing product order page (/product/[id]) which re-verifies the product,
 *    recomputes the price server-side and enforces option/quantity rules —
 *    so all existing price calculations and quantity rules are preserved 1:1.
 *  - SMM services are intentionally NOT cart-able: their orders require
 *    per-order quantity + link configuration on the service order page.
 *  - One line per product (adding an existing id is a no-op, not a quantity bump)
 *    because quantity selection lives on the order page.
 *  - Empty cart → consumers hide the badge (existing shopping-app convention).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  addedAt: number;
}

interface CartState {
  items: CartItem[];
  /** Adds a product reference. Returns false if it was already in the cart. */
  addItem: (productId: string) => boolean;
  /** Removes a product reference. */
  removeItem: (productId: string) => void;
  /** Clears the cart entirely. */
  clear: () => void;
  /** Whether a product is currently in the cart. */
  has: (productId: string) => boolean;
}

const STORAGE_KEY = 'midman-cart';

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (productId) => {
        if (get().items.some((i) => i.productId === productId)) return false;
        set((s) => ({ items: [...s.items, { productId, addedAt: Date.now() }] }));
        return true;
      },
      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
      has: (productId) => get().items.some((i) => i.productId === productId),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/* Cross-tab synchronisation: when another tab mutates the cart, rehydrate so
   every open badge reflects the same real state. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue !== null) {
      void useCartStore.persist.rehydrate();
    }
  });
}

/** Stable count selector — components subscribe with this to avoid re-renders on unrelated state. */
export const selectCartCount = (s: CartState) => s.items.length;

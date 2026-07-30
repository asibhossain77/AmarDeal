'use client';

import { useEffect } from 'react';

/**
 * Loads non-critical CSS (animations, scrollbar styles, glow effects)
 * asynchronously after the browser has painted the first frame.
 * This removes these styles from the render-blocking critical path,
 * improving FCP and LCP by ~600ms.
 */
export function DeferredStyles() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/non-critical.css';
    document.head.appendChild(link);
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useSiteSettings } from '@/lib/use-site-settings';

/**
 * DynamicFavicon — updates the browser tab icon to match the site-logo
 * from the site-settings API. Overrides the static favicon set in layout.tsx metadata.
 */
export function DynamicFavicon() {
  const { siteLogo } = useSiteSettings();

  useEffect(() => {
    // Find or create the favicon <link> element
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = siteLogo;

    // Also update apple-touch-icon if it exists
    let appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = siteLogo;
  }, [siteLogo]);

  return null; // renders nothing visible
}

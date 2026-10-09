'use client';

import { useEffect } from 'react';

/**
 * Puts the company's square icon (Settings → Branding) on the browser tab while
 * this page is open, and takes it off again on leaving or when it is removed.
 */
export function useBrandFavicon(href: string | null | undefined) {
  useEffect(() => {
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    link.dataset.brand = 'true';
    // Browsers use the last icon in <head>
    document.head.appendChild(link);
    return () => link.remove();
  }, [href]);
}

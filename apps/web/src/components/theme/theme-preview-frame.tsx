'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ThemeTokens } from '@hrms/types';
import type { PreviewMessage, PreviewPage } from '@/lib/theme/preview';
import { cn } from '@/lib/cn';

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTH: Record<PreviewDevice, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

/**
 * Live, isolated preview of a mock company portal (/theme-preview in an
 * iframe). Tokens are pushed via postMessage on every change, so the
 * preview updates instantly without reloading.
 */
export function ThemePreviewFrame({
  tokens,
  mode,
  page,
  device = 'desktop',
  height = 640,
  className,
  companyName,
}: {
  tokens: ThemeTokens;
  mode: 'light' | 'dark';
  page: PreviewPage;
  companyName?: string;
  device?: PreviewDevice;
  height?: number;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const post = useCallback(() => {
    const message: PreviewMessage = { type: 'hrms-theme-preview', tokens, mode, page, companyName };
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [tokens, mode, page, companyName]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'hrms-theme-preview-ready') return;
      if (e.source === iframeRef.current?.contentWindow) setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (ready) post();
  }, [ready, post]);

  return (
    <div
      className={cn(
        'flex justify-center bg-muted/40 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] p-4 [background-size:16px_16px]',
        className,
      )}
    >
      <div
        className="overflow-hidden rounded-lg border border-border bg-background shadow-dialog transition-[width] duration-300 ease-out"
        style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}
      >
        <iframe
          ref={iframeRef}
          src="/theme-preview"
          title="Theme preview"
          className="block w-full"
          style={{ height }}
          onLoad={post}
        />
      </div>
    </div>
  );
}

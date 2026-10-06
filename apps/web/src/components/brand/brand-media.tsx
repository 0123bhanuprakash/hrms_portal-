'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/components/engagement/cover';

// ============================================================
// BrandMedia — a logo or sign-in picture that may be a still
// image, a GIF / animated WebP, a Lottie animation (.json), a
// short video (.mp4 / .webm) or a 3D model (.glb).
// The kind comes from the file extension in the URL.
// ============================================================

export type MediaKind = 'image' | 'lottie' | 'video' | 'model';

export function mediaKind(src: string): MediaKind {
  const lower = src.toLowerCase();
  // A local preview (blob:) carries its extension after # — e.g. blob:…#.json
  const path = lower.startsWith('blob:') ? (lower.split('#')[1] ?? '') : lower.split(/[?#]/)[0]!;
  if (path.endsWith('.json')) return 'lottie';
  if (path.endsWith('.mp4') || path.endsWith('.webm')) return 'video';
  if (path.endsWith('.glb')) return 'model';
  return 'image';
}

/** Kind of a picked file (before upload). `.glb` often has no MIME type. */
export function fileMediaKind(f: File): MediaKind {
  const name = f.name.toLowerCase();
  if (f.type === 'application/json' || name.endsWith('.json')) return 'lottie';
  if (f.type.startsWith('video/')) return 'video';
  if (f.type === 'model/gltf-binary' || name.endsWith('.glb')) return 'model';
  return 'image';
}

export function BrandMedia({
  src,
  alt = '',
  className,
  fit = 'contain',
  kind,
  interactive = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  fit?: 'contain' | 'cover';
  /** Override the kind (e.g. for a blob: preview URL) */
  kind?: MediaKind;
  /** 3D models: let people drag to turn them */
  interactive?: boolean;
}) {
  const reduce = useReducedMotion();
  const k = kind ?? mediaKind(src);
  const fitCls = fit === 'cover' ? 'object-cover' : 'object-contain';

  if (k === 'video') {
    return <BrandVideo src={src} still={reduce} className={cn(fitCls, className)} label={alt} />;
  }
  if (k === 'lottie') return <BrandLottie src={src} still={reduce} fit={fit} className={className} label={alt} />;
  if (k === 'model') return <BrandModel src={src} still={reduce} interactive={interactive} className={className} label={alt} />;
  return <img src={src} alt={alt} className={cn(fitCls, className)} />;
}

function BrandVideo({ src, still, className, label }: { src: string; still: boolean; className?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (still) v.pause();
    else void v.play().catch(() => undefined);
  }, [still, src]);
  return <video ref={ref} src={src} className={className} autoPlay={!still} muted loop playsInline aria-label={label || undefined} aria-hidden={!label || undefined} />;
}

function BrandLottie({ src, still, fit, className, label }: { src: string; still: boolean; fit: 'contain' | 'cover'; className?: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let anim: { destroy: () => void } | null = null;
    let cancelled = false;
    setFailed(false);
    (async () => {
      try {
        const [{ default: lottie }, data] = await Promise.all([import('lottie-web/build/player/lottie_light'), fetch(src).then((r) => r.json())]);
        if (cancelled || !box.current) return;
        anim = lottie.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop: true,
          autoplay: !still,
          animationData: data,
          rendererSettings: { preserveAspectRatio: fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet' },
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [src, still, fit]);
  if (failed) return <span className={className} aria-hidden />;
  return <div ref={box} role={label ? 'img' : undefined} aria-label={label || undefined} className={cn('[&>svg]:!h-full [&>svg]:!w-full', className)} />;
}

// @google/model-viewer 4.3.1, served as a file (public/vendor) rather than bundled:
// its source has a runtime-only dynamic import that Turbopack can't build.
let modelViewerLoad: Promise<unknown> | null = null;
function loadModelViewer() {
  modelViewerLoad ??= customElements.get('model-viewer')
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.type = 'module';
        s.src = '/vendor/model-viewer.min.js';
        s.onload = () => void customElements.whenDefined('model-viewer').then(() => resolve());
        s.onerror = () => {
          modelViewerLoad = null;
          reject(new Error('3D viewer failed to load'));
        };
        document.head.appendChild(s);
      });
  return modelViewerLoad;
}

function BrandModel({ src, still, interactive, className, label }: { src: string; still: boolean; interactive: boolean; className?: string; label: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let off = false;
    const modelViewerLoad = loadModelViewer();
    void modelViewerLoad.then(
      () => !off && setReady(true),
      () => undefined,
    );
    return () => {
      off = true;
    };
  }, []);
  if (!ready) return <span className={cn('animate-pulse bg-muted/40', className)} aria-hidden />;
  return React.createElement('model-viewer', {
    src,
    alt: label || '3D logo',
    'auto-rotate': still ? undefined : '',
    'rotation-per-second': '25deg',
    'auto-rotate-delay': '0',
    'camera-controls': interactive ? '' : undefined,
    'disable-zoom': '',
    'interaction-prompt': 'none',
    'shadow-intensity': '0',
    exposure: '1',
    loading: 'eager',
    className,
    style: { background: 'transparent', '--poster-color': 'transparent', '--progress-bar-height': '0px' } as React.CSSProperties,
  });
}

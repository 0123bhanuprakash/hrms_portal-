'use client';

/* eslint-disable @next/next/no-img-element */
import { useTheme } from 'next-themes';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Droplet, ImageIcon, Lock, Mail, Monitor, Moon, Palette, Smartphone, Sun, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { useAuthStore } from '@/store/useAuthStore';
import { useAccess } from '@/lib/access/use-access';
import { useCompanyBranding, useUpdateCompanyBranding, useUploadBrandingAsset, type CompanyBrandingResponse } from '@/lib/company/queries';
import { getApiErrorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { BrandMedia, fileMediaKind, mediaKind } from '@/components/brand/brand-media';

type Kind = 'logo' | 'logo-dark' | 'favicon' | 'sign-in-photo';
const MB = 1024 * 1024;
// Animated (GIF, Lottie JSON, MP4/WebM video) and 3D (GLB) files are allowed for logos and the sign-in page
const MOTION_TYPES = 'image/gif,image/apng,application/json,.json,video/mp4,video/webm,model/gltf-binary,.glb';
const ASSETS: Record<Kind, { title: string; hint: string; accept: string; maxBytes: number; motionMaxBytes?: number; field?: 'logoUrl' | 'logoDarkUrl' | 'faviconUrl' | 'signInPhotoUrl' }> = {
  logo: { title: 'Logo', hint: 'Image, GIF, Lottie, video or 3D (GLB) · images up to 2 MB, motion up to 5 MB', accept: `image/png,image/jpeg,image/svg+xml,image/webp,${MOTION_TYPES}`, maxBytes: 2 * MB, motionMaxBytes: 5 * MB, field: 'logoUrl' },
  'logo-dark': { title: 'Logo for dark mode', hint: 'Usually a white version · image, GIF, Lottie, video or 3D', accept: `image/png,image/jpeg,image/svg+xml,image/webp,${MOTION_TYPES}`, maxBytes: 2 * MB, motionMaxBytes: 5 * MB, field: 'logoDarkUrl' },
  favicon: { title: 'Square icon', hint: 'Browser tabs and bookmarks · up to 500 KB', accept: 'image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml,image/jpeg', maxBytes: 500 * 1024, field: 'faviconUrl' },
  'sign-in-photo': { title: 'Sign-in picture', hint: 'Photo, GIF, Lottie, video (MP4/WebM) or 3D (GLB) · photos up to 4 MB, motion up to 15 MB · wide works best', accept: `image/png,image/jpeg,image/webp,${MOTION_TYPES}`, maxBytes: 4 * MB, motionMaxBytes: 15 * MB, field: 'signInPhotoUrl' },
};
const EXT: Record<ReturnType<typeof fileMediaKind>, string> = { image: '', lottie: 'json', video: 'mp4', model: 'glb' };

type Form = { displayName: string; tagline: string; signInMessage: string; signInBackground: 'pack' | 'photo' | 'plain' };

export default function BrandingPage() {
  const { user, companyId } = useAuthStore();
  const { can } = useAccess();
  const router = useRouter();
  const branding = useCompanyBranding(companyId);
  const update = useUpdateCompanyBranding(companyId ?? '');
  const canEdit = Boolean(user?.isSuperAdmin || can('branding.manage'));
  const [form, setForm] = useState<Form>({ displayName: '', tagline: '', signInMessage: '', signInBackground: 'pack' });
  // Local preview while a file uploads (cleared once the saved URL comes back)
  const [fresh, setFresh] = useState<Partial<Record<Kind, string>>>({});
  const freshFor = (k: Kind) => (u: string | undefined) => setFresh((f) => ({ ...f, [k]: u }));
  const [colors, setColors] = useState<string[] | null>(null);
  const b = branding.data;

  useEffect(() => {
    if (b) setForm({ displayName: b.displayName, tagline: b.tagline ?? '', signInMessage: b.signInMessage ?? '', signInBackground: b.signInBackground ?? 'pack' });
  }, [b]);

  // Colours from the logo (fresh upload first, else the saved one)
  const logoSrc = fresh.logo ?? b?.logoUrl ?? null;
  useEffect(() => {
    if (!logoSrc || mediaKind(logoSrc) !== 'image') return setColors(null);
    let off = false;
    void logoColours(logoSrc).then((c) => !off && setColors(c));
    return () => {
      off = true;
    };
  }, [logoSrc]);

  if (!canEdit) {
    return (
      <Card>
        <EmptyState icon={<Lock />} title="Branding is managed by your administrators" description="Ask a Company Admin to update the logo or company name." />
      </Card>
    );
  }
  if (branding.isLoadingError) return <ErrorState message={getApiErrorMessage(branding.error, 'Could not load your branding')} onRetry={() => void branding.refetch()} />;
  if (!b || !companyId) return <Skeleton className="h-[70vh] rounded-xl" />;

  const dirty = form.displayName.trim() !== b.displayName || form.tagline.trim() !== (b.tagline ?? '') || form.signInMessage.trim() !== (b.signInMessage ?? '') || form.signInBackground !== (b.signInBackground ?? 'pack');
  const save = async () => {
    if (!form.displayName.trim()) {
      toast.error('The company name can’t be empty');
      return;
    }
    try {
      await update.mutateAsync({ displayName: form.displayName.trim(), tagline: form.tagline.trim(), signInMessage: form.signInMessage.trim(), signInBackground: form.signInBackground });
      toast.success('Brand saved — the portal and sign-in page are updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };
  const view = { ...b, displayName: form.displayName || b.displayName, tagline: form.tagline, signInMessage: form.signInMessage, signInBackground: form.signInBackground, logoUrl: fresh.logo ?? b.logoUrl, logoDarkUrl: fresh['logo-dark'] ?? b.logoDarkUrl, faviconUrl: fresh.favicon ?? b.faviconUrl, signInPhotoUrl: fresh['sign-in-photo'] ?? b.signInPhotoUrl };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Branding"
        description="Your name, logos and sign-in page — see every change live before you save."
        action={
          <div className="flex items-center gap-2">
            {dirty && <Badge tone="warning" dot>Unsaved changes</Badge>}
            <Button variant="secondary" disabled={!dirty || update.isPending} onClick={() => b && setForm({ displayName: b.displayName, tagline: b.tagline ?? '', signInMessage: b.signInMessage ?? '', signInBackground: b.signInBackground ?? 'pack' })}>
              Discard
            </Button>
            <Button onClick={() => void save()} loading={update.isPending} disabled={!dirty}>Save brand</Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Name" description="How your company appears to employees." />
            <div className="space-y-3 px-5 pb-5">
              <Field label="Display name" htmlFor="br-name" required>
                <Input id="br-name" value={form.displayName} maxLength={80} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              </Field>
              <Field label="Short line under the name" htmlFor="br-tag" hint="Shown under the logo in the side menu.">
                <Input id="br-tag" value={form.tagline} maxLength={60} placeholder="HR workspace" onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Logos" description="Drop an image on a box, or click it." icon={<ImageIcon />} />
            <div className="grid grid-cols-3 gap-3 px-5 pb-5">
              <AssetBox kind="logo" companyId={companyId} current={view.logoUrl} name={view.displayName} onFresh={freshFor('logo')} />
              <AssetBox kind="logo-dark" companyId={companyId} current={view.logoDarkUrl ?? null} name={view.displayName} dark onFresh={freshFor('logo-dark')} />
              <AssetBox kind="favicon" companyId={companyId} current={view.faviconUrl} name={view.displayName} onFresh={freshFor('favicon')} />
            </div>
          </Card>

          {colors && colors.length > 0 && (
            <Card className="border-primary/30">
              <CardHeader title="Colours from your logo" description="Picked out of your logo — use them for your theme." icon={<Droplet />} />
              <div className="space-y-3 px-5 pb-5">
                <div className="flex flex-wrap gap-3 m-stagger">
                  {colors.map((c) => (
                    <span key={c} className="flex flex-col items-center gap-1 m-pop">
                      <span className="h-10 w-10 rounded-xl border border-black/10 shadow-sm" style={{ background: c }} />
                      <span className="font-mono text-[10px] text-muted-foreground">{c}</span>
                    </span>
                  ))}
                </div>
                <Button size="sm" onClick={() => router.push(`/app/settings/theme?primary=${encodeURIComponent(colors[0]!)}`)}>
                  <Palette /> Make a theme from these
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Sign-in page" description="What people see before they sign in." />
            <div className="space-y-3 px-5 pb-5">
              <Field label="Welcome line" htmlFor="br-welcome">
                <Input id="br-welcome" value={form.signInMessage} maxLength={80} placeholder="Good to see you 👋" onChange={(e) => setForm({ ...form, signInMessage: e.target.value })} />
              </Field>
              <Field label="Background">
                <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-sm" role="radiogroup" aria-label="Background">
                  {([['pack', 'Our background'], ['photo', 'Your own'], ['plain', 'Plain']] as const).map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={form.signInBackground === v} onClick={() => setForm({ ...form, signInBackground: v })} className={cn('rounded-md px-3 py-1', form.signInBackground === v ? 'bg-surface font-medium shadow-sm' : 'text-muted-foreground')}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              {form.signInBackground === 'photo' && (
                <AssetBox kind="sign-in-photo" wide companyId={companyId} current={view.signInPhotoUrl ?? null} name={view.displayName} onFresh={freshFor('sign-in-photo')} />
              )}
            </div>
          </Card>
        </div>

        <Previews b={view} />
      </div>
    </div>
  );
}

// ─── Upload box ─────────────────────────────────────────────

function AssetBox({ kind, companyId, current, name, dark, wide, onFresh }: { kind: Kind; companyId: string; current: string | null; name: string; dark?: boolean; wide?: boolean; onFresh: (url: string | undefined) => void }) {
  const meta = ASSETS[kind];
  const upload = useUploadBrandingAsset(companyId, kind);
  const update = useUpdateCompanyBranding(companyId);
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = async (f: File | undefined) => {
    if (!f) return;
    const k = fileMediaKind(f);
    const accepted = meta.accept.split(',');
    const typeOk = accepted.includes(f.type) || (k !== 'image' && accepted.includes(`.${EXT[k]}`) && f.name.toLowerCase().endsWith(`.${EXT[k]}`));
    const limit = f.type === 'image/gif' || k !== 'image' ? (meta.motionMaxBytes ?? meta.maxBytes) : meta.maxBytes;
    if (!typeOk || f.size > limit) {
      toast.error(`That file won’t work. ${meta.hint}`);
      return;
    }
    // The extension after # tells the preview how to play a local file
    onFresh(`${URL.createObjectURL(f)}${EXT[k] ? `#.${EXT[k]}` : ''}`);
    try {
      await upload.mutateAsync(f);
      toast.success(`${meta.title} updated`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Could not upload the ${meta.title.toLowerCase()}`));
    } finally {
      onFresh(undefined);
    }
  };
  const remove = async () => {
    if (!meta.field) return;
    try {
      await update.mutateAsync({ [meta.field]: null });
      onFresh(undefined);
      toast.success(`${meta.title} removed`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Could not remove the ${meta.title.toLowerCase()}`));
    }
  };
  return (
    <div className={cn('relative flex flex-col items-center gap-1.5', wide && 'items-stretch')}>
      <button
        type="button"
        title={meta.hint}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
        className={cn(
          'relative flex w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          wide ? 'h-28' : 'h-20',
          dark ? 'bg-[#17151F]' : 'bg-white',
          over ? 'border-primary' : 'border-border hover:border-foreground/30',
        )}
      >
        {current ? (
          <BrandMedia src={current} alt={meta.title} fit={wide ? 'cover' : 'contain'} className={wide ? 'h-full w-full' : 'h-12 w-12'} />
        ) : (
          <span className={cn('flex flex-col items-center gap-1 text-xs', dark ? 'text-white/60' : 'text-zinc-400')}>
            <Upload className="h-4 w-4" /> {wide ? 'Drop a photo, animation or 3D model' : initials(name || 'Co')}
          </span>
        )}
        {(upload.isPending || update.isPending) && <span className="absolute inset-0 animate-pulse bg-primary/10" />}
      </button>
      {current && meta.field && !upload.isPending && (
        <button
          type="button"
          aria-label={`Remove ${meta.title.toLowerCase()}`}
          title={`Remove ${meta.title.toLowerCase()}`}
          disabled={update.isPending}
          onClick={() => void remove()}
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="text-center text-[11px] text-muted-foreground">{meta.title}</span>
      <input ref={ref} type="file" accept={meta.accept} className="hidden" onChange={(e) => void take(e.target.files?.[0])} />
    </div>
  );
}

// ─── Live previews ──────────────────────────────────────────

function Previews({ b }: { b: CompanyBrandingResponse }) {
  const [phone, setPhone] = useState(false);
  const [darkMenu, setDarkMenu] = useState(false);
  // In dark mode the preview side menu is dark too, so it needs the dark logo
  const appDark = useTheme().resolvedTheme === 'dark';
  const mark = (size: number, darkBg = false) => {
    const onDark = darkBg;
    const src = onDark && b.logoDarkUrl ? b.logoDarkUrl : b.logoUrl;
    return src ? (
      <span className={cn('flex shrink-0 overflow-hidden rounded-lg', !(onDark && b.logoDarkUrl) && 'bg-white p-0.5')} style={{ width: size, height: size }}>
        <BrandMedia src={src} className="h-full w-full" />
      </span>
    ) : (
      <span className="flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-[10px] font-bold text-primary-foreground" style={{ width: size, height: size }}>
        {initials(b.displayName)}
      </span>
    );
  };
  return (
    <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold">Live preview</p>
        <div className="inline-flex rounded-lg border border-border bg-muted p-0.5" role="group" aria-label="Device">
          {[[false, <Monitor key="m" />, 'Desktop'], [true, <Smartphone key="s" />, 'Phone']].map(([v, ic, l]) => (
            <button key={String(v)} type="button" aria-label={l as string} aria-pressed={phone === v} onClick={() => setPhone(v as boolean)} className={cn('rounded-md px-2 py-1 [&_svg]:size-4', phone === v ? 'bg-surface shadow-sm' : 'text-muted-foreground')}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Browser tab + side menu */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="flex h-8 items-end gap-2 border-b border-border bg-muted px-3">
          <span className="mb-2.5 flex gap-1">{[0, 1, 2].map((i) => <i key={i} className="h-2 w-2 rounded-full bg-border" />)}</span>
          <span className="flex h-6 max-w-[220px] items-center gap-1.5 rounded-t-lg bg-surface px-3 text-[11px] font-medium">
            {b.faviconUrl ? <img src={b.faviconUrl} alt="" className="h-3.5 w-3.5 object-contain" /> : mark(14)}
            <span className="truncate">{b.displayName} — Home</span>
          </span>
        </div>
        <div className={cn('flex', phone ? 'h-[170px] justify-center bg-muted/40 py-2' : 'h-[170px]')}>
          <div className={cn('flex flex-col gap-1.5 border-r p-2.5', phone ? 'w-[180px] rounded-xl border' : 'w-[190px]', darkMenu ? 'border-white/10 bg-[#17151F] text-white' : 'border-border bg-surface')}>
            <div className="mb-1 flex items-center gap-2">
              {mark(28, darkMenu || appDark)}
              <span className="min-w-0 leading-tight">
                <b className="block truncate text-[12px]">{b.displayName}</b>
                <span className={cn('block truncate text-[10px]', darkMenu ? 'text-white/60' : 'text-muted-foreground')}>{b.tagline || 'HR workspace'}</span>
              </span>
            </div>
            {['Home', 'My profile', 'People', 'Leave'].map((t, i) => (
              <span key={t} className={cn('rounded-md px-2 py-1 text-[10.5px]', i === 0 ? 'bg-primary/15 font-semibold text-primary' : darkMenu ? 'text-white/60' : 'text-muted-foreground')}>
                {t}
              </span>
            ))}
          </div>
          {!phone && (
            <div className="flex flex-1 flex-col gap-2 bg-muted/30 p-3">
              <span className="h-2.5 w-1/3 rounded bg-border" />
              <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <span key={i} className="h-14 rounded-lg border border-border bg-surface" />)}</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="flex-1">Side menu</span>
          <button type="button" onClick={() => setDarkMenu(!darkMenu)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-muted">
            {darkMenu ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {darkMenu ? 'Light' : 'Dark'} mode
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        {/* Sign-in page */}
        <div className="relative flex h-[230px] items-center justify-center overflow-hidden rounded-2xl border border-border shadow-card">
          {b.signInBackground === 'photo' && b.signInPhotoUrl ? (
            <BrandMedia src={b.signInPhotoUrl} fit="cover" className="absolute inset-0 h-full w-full" />
          ) : b.signInBackground === 'plain' ? (
            <span className="absolute inset-0 bg-muted" />
          ) : (
            <span className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/50">
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#ffffff40,transparent_40%),radial-gradient(circle_at_80%_75%,#ffffff26,transparent_45%)]" />
            </span>
          )}
          <div className="relative flex w-[200px] flex-col items-center gap-1.5 rounded-xl bg-white p-3.5 text-zinc-900 shadow-xl">
            {mark(28)}
            <b className="text-center text-[12px]">{b.signInMessage || 'Sign in to your account'}</b>
            <span className="h-5 w-full rounded bg-zinc-100" />
            <span className="h-5 w-full rounded bg-zinc-100" />
            <span className="h-5 w-full rounded bg-primary" />
          </div>
          <Badge tone="neutral" className="absolute left-2 top-2">Sign-in page</Badge>
        </div>
        {/* Email */}
        <div className="flex h-[230px] flex-col overflow-hidden rounded-2xl border border-border bg-white text-zinc-900 shadow-card">
          <div className="flex items-center gap-2 bg-primary px-3 py-2.5 text-primary-foreground">
            {mark(22)}
            <b className="truncate text-[12px]">{b.displayName}</b>
          </div>
          <div className="flex flex-col gap-1.5 p-3">
            <b className="text-[12px]">Your leave was approved ✓</b>
            {[90, 72, 80].map((w) => <span key={w} className="h-1.5 rounded bg-zinc-100" style={{ width: `${w}%` }} />)}
            <span className="mt-1 h-5 w-24 rounded bg-primary" />
          </div>
          <span className="mt-auto flex items-center gap-1 px-3 pb-2 text-[10.5px] text-zinc-500"><Mail className="h-3 w-3" /> Emails</span>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Colours come from your <Link className="text-primary hover:underline" href="/app/settings/theme">theme</Link>.
      </p>
    </div>
  );
}

// ─── Colours out of a logo ──────────────────────────────────

/** Up to 5 strong colours from an image (ignores near-white, near-black and see-through pixels). */
async function logoColours(src: string): Promise<string[] | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, bl, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
      if (a < 200) continue;
      const max = Math.max(r, g, bl);
      const min = Math.min(r, g, bl);
      if (max > 240 && min > 230) continue; // white
      if (max < 25) continue; // black
      const key = `${r >> 5}-${g >> 5}-${bl >> 5}`;
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++;
      e.r += r;
      e.g += g;
      e.b += bl;
      buckets.set(key, e);
    }
    const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
    const picked = [...buckets.values()]
      .filter((e) => e.n > 6)
      .map((e) => {
        const [r, g, bl] = [e.r / e.n, e.g / e.n, e.b / e.n];
        const sat = (Math.max(r, g, bl) - Math.min(r, g, bl)) / 255;
        return { hex: `#${hex(r)}${hex(g)}${hex(bl)}`.toUpperCase(), score: e.n * (0.4 + sat) };
      })
      .sort((a, b) => b.score - a.score);
    // Skip colours too close to one already picked
    const out: string[] = [];
    const dist = (a: string, b: string) => {
      const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
      return Math.abs(p(a, 0) - p(b, 0)) + Math.abs(p(a, 1) - p(b, 1)) + Math.abs(p(a, 2) - p(b, 2));
    };
    for (const c of picked) {
      if (out.every((o) => dist(o, c.hex) > 70)) out.push(c.hex);
      if (out.length === 5) break;
    }
    return out;
  } catch {
    return null; // the image can't be read (e.g. another site)
  }
}


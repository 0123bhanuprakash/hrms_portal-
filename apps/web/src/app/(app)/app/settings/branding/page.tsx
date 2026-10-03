'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, ImageIcon, Lock, Palette, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { useAuthStore } from '@/store/useAuthStore';
import { useAccess } from '@/lib/access/use-access';
import { useCompanyBranding, useUpdateCompanyBranding, useUploadBrandingAsset } from '@/lib/company/queries';
import { getApiErrorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

const ASSETS = {
  logo: {
    title: 'Logo',
    description: 'Shown in the sidebar and on your sign-in page.',
    accept: 'image/png,image/jpeg,image/svg+xml,image/webp',
    hint: 'PNG, JPG, SVG or WebP · up to 2 MB · square works best',
    maxBytes: 2 * 1024 * 1024,
  },
  favicon: {
    title: 'Favicon',
    description: 'The small icon in browser tabs and bookmarks.',
    accept: 'image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml,image/jpeg',
    hint: 'ICO, PNG, SVG or JPG · up to 500 KB · 32×32 or larger',
    maxBytes: 500 * 1024,
  },
} as const;

export default function BrandingPage() {
  const { user, companyId } = useAuthStore();
  const { can } = useAccess();
  const branding = useCompanyBranding(companyId);
  const update = useUpdateCompanyBranding(companyId ?? '');
  const canEdit = Boolean(user?.isSuperAdmin || can('branding.manage'));
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (branding.data) setDisplayName(branding.data.displayName);
  }, [branding.data]);

  if (!canEdit) {
    return (
      <Card>
        <EmptyState icon={<Lock />} title="Branding is managed by your administrators" description="Ask a Company Admin to update the logo or company name." />
      </Card>
    );
  }

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    try {
      await update.mutateAsync({ displayName: displayName.trim() });
      toast.success('Display name updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update display name'));
    }
  };

  const nameDirty = branding.data && displayName.trim() !== branding.data.displayName;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Branding" description="Your company's name and logos across the portal and sign-in page." />

      <Card>
        <CardHeader title="Display name" description="How your company appears to employees." />
        <form onSubmit={saveName} className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end">
          <Field label="Name" htmlFor="display-name" className="flex-1">
            {branding.isLoading ? (
              <Skeleton className="h-9" />
            ) : (
              <Input id="display-name" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} />
            )}
          </Field>
          <Button type="submit" loading={update.isPending} disabled={!nameDirty || !displayName.trim()}>
            Save name
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <AssetCard kind="logo" companyId={companyId!} currentUrl={branding.data?.logoUrl ?? null} name={branding.data?.displayName ?? ''} />
        <AssetCard kind="favicon" companyId={companyId!} currentUrl={branding.data?.faviconUrl ?? null} name={branding.data?.displayName ?? ''} />
      </div>

      <Link
        href="/app/settings/theme"
        className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-menu"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Palette className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">Looking for colors?</span>
          <span className="block text-xs text-muted-foreground">Colors, fonts and shapes now live in your theme — with a live preview.</span>
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function AssetCard({ kind, companyId, currentUrl, name }: { kind: 'logo' | 'favicon'; companyId: string; currentUrl: string | null; name: string }) {
  const meta = ASSETS[kind];
  const upload = useUploadBrandingAsset(companyId, kind);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (f: File | undefined) => {
    if (!f) return;
    if (!meta.accept.split(',').includes(f.type)) {
      toast.error(`Unsupported file type. ${meta.hint}`);
      return;
    }
    if (f.size > meta.maxBytes) {
      toast.error(`File is too large. ${meta.hint}`);
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast.success(`${meta.title} updated`);
      setFile(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Could not upload ${kind}`));
    }
  };

  const shown = preview ?? currentUrl;

  return (
    <Card>
      <CardHeader title={meta.title} description={meta.description} icon={<ImageIcon />} />
      <div className="space-y-3 px-5 pb-5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files[0]);
          }}
          className={cn(
            'flex w-full items-center gap-4 rounded-lg border border-dashed p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            dragging ? 'border-primary bg-primary-soft/40' : 'border-input hover:border-foreground/30 hover:bg-muted/40',
          )}
        >
          <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white', kind === 'logo' ? 'h-16 w-16' : 'h-10 w-10')}>
            {shown ? (
              <img src={shown} alt={`${meta.title} preview`} className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-sm font-bold text-zinc-500">{initials(name || 'Co')}</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Upload className="h-3.5 w-3.5" /> {file ? file.name : 'Drop an image or click to browse'}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{meta.hint}</span>
          </span>
        </button>
        <input ref={inputRef} type="file" accept={meta.accept} className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
        {file && (
          <div className="flex justify-end gap-2 animate-in fade-in-0">
            <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={upload.isPending}>Cancel</Button>
            <Button size="sm" onClick={submit} loading={upload.isPending}>Upload {kind}</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

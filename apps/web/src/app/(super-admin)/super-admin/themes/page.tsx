'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Building2,
  Check,
  Copy,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { CustomTheme, ThemeRef, ThemeTokens } from '@hrms/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { ThemeSwatches, ThemeThumbnail } from '@/components/theme/theme-card';
import { useCustomThemes, useDeleteTheme, useThemeSettings, useUpdateThemeSettings } from '@/lib/admin/queries';
import { THEME_PRESETS, type ThemeCollection } from '@/lib/theme/presets';
import { ThemeArt } from '@/components/theme/theme-art';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type Scope = 'superAdminTheme' | 'defaultCompanyTheme';

const SCOPES: Record<Scope, { label: string; description: string; icon: React.ReactNode }> = {
  superAdminTheme: {
    label: 'Super Admin portal',
    description: 'How this platform console looks for every Super Admin.',
    icon: <ShieldCheck />,
  },
  defaultCompanyTheme: {
    label: 'Default for new companies',
    description: 'Starting theme for newly onboarded companies. Company Admins can customize it later.',
    icon: <Building2 />,
  },
};

interface LibraryItem {
  ref: ThemeRef;
  id: string;
  name: string;
  description: string | null;
  tokens: ThemeTokens;
  custom?: CustomTheme;
  collection?: ThemeCollection;
  mood?: string;
}

const sameRef = (a: ThemeRef, b: ThemeRef) =>
  a.kind === b.kind && (a.kind === 'preset' ? a.key === (b as { key: string }).key : a.id === (b as { id: string }).id);

const refParam = (ref: ThemeRef) => (ref.kind === 'preset' ? `preset:${ref.key}` : `custom:${ref.id}`);

export default function ThemesPage() {
  const router = useRouter();
  const settings = useThemeSettings();
  const custom = useCustomThemes();
  const updateSettings = useUpdateThemeSettings();
  const deleteTheme = useDeleteTheme();
  const [picker, setPicker] = useState<Scope | null>(null);
  const [toDelete, setToDelete] = useState<CustomTheme | null>(null);

  const presets: LibraryItem[] = useMemo(
    () =>
      THEME_PRESETS.map((p) => ({
        ref: { kind: 'preset', key: p.key },
        id: `preset:${p.key}`,
        name: p.name,
        description: p.description,
        tokens: p.tokens,
        collection: p.collection,
        mood: p.mood,
      })),
    [],
  );
  const customs: LibraryItem[] = useMemo(
    () =>
      (custom.data ?? []).map((t) => ({ ref: { kind: 'custom', id: t.id }, id: t.id, name: t.name, description: t.description, tokens: t.tokens, custom: t })),
    [custom.data],
  );
  const all = [...presets, ...customs];

  const nameOf = (ref: ThemeRef | undefined) => (ref ? all.find((i) => sameRef(i.ref, ref)) : undefined);

  const assign = async (scope: Scope, item: LibraryItem) => {
    try {
      await updateSettings.mutateAsync({ [scope]: item.ref });
      toast.success(`${item.name} is now the ${SCOPES[scope].label.toLowerCase()} theme`);
      setPicker(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update theme assignment'));
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await deleteTheme.mutateAsync(toDelete.id);
      toast.success(`Deleted “${toDelete.name}”`);
      setToDelete(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not delete theme'));
    }
  };

  const assignedScopes = (item: LibraryItem): Scope[] =>
    settings.data ? (Object.keys(SCOPES) as Scope[]).filter((s) => sameRef(settings.data![s], item.ref)) : [];

  const renderCard = (item: LibraryItem) => {
    const scopes = assignedScopes(item);
    return (
      <ThemeCard
        key={item.id}
        item={item}
        scopes={scopes}
        onApply={() => assign('superAdminTheme', item)}
        menu={[
          {
            label: 'Use for Super Admin portal',
            icon: <ShieldCheck />,
            disabled: scopes.includes('superAdminTheme'),
            onSelect: () => assign('superAdminTheme', item),
          },
          {
            label: 'Set as default for new companies',
            icon: <Building2 />,
            disabled: scopes.includes('defaultCompanyTheme'),
            onSelect: () => assign('defaultCompanyTheme', item),
          },
          'separator',
          item.custom
            ? { label: 'Edit theme', icon: <Pencil />, onSelect: () => router.push(`/super-admin/themes/editor?id=${item.custom!.id}`) }
            : { label: 'Customize a copy', icon: <Palette />, onSelect: () => router.push(`/super-admin/themes/editor?from=${refParam(item.ref)}`) },
          ...(item.custom
            ? [
                { label: 'Duplicate', icon: <Copy />, onSelect: () => router.push(`/super-admin/themes/editor?from=${refParam(item.ref)}`) },
                'separator' as const,
                {
                  label: 'Delete',
                  icon: <Trash2 />,
                  danger: true,
                  disabled: scopes.length > 0,
                  hint: scopes.length ? 'In use — assign another theme first' : undefined,
                  onSelect: () => setToDelete(item.custom!),
                },
              ]
            : []),
        ]}
      />
    );
  };

  const current = settings.data ? nameOf(settings.data.superAdminTheme) : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Themes"
        description="Pick a suggested theme or build your own. Every change previews live before anyone sees it."
        action={
          <Button asChild>
            <Link href={`/super-admin/themes/editor${settings.data ? `?from=${refParam(settings.data.superAdminTheme)}` : ''}`}>
              <Plus /> Create theme
            </Link>
          </Button>
        }
      />

      {/* Assignments */}
      <Card>
        <CardHeader title="Where themes are used" description="Each scope can use a different theme." icon={<Sparkles />} />
        <div className="grid divide-y divide-border border-t border-border md:grid-cols-2 md:divide-x md:divide-y-0">
          {(Object.keys(SCOPES) as Scope[]).map((scope) => {
            const item = settings.data ? nameOf(settings.data[scope]) : undefined;
            return (
              <div key={scope} className="flex items-center gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground [&_svg]:size-[18px]">
                  {SCOPES[scope].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-muted-foreground">{SCOPES[scope].label}</p>
                  {settings.isLoading ? (
                    <Skeleton className="mt-1.5 h-4 w-32" />
                  ) : (
                    <p className="mt-0.5 flex items-center gap-2 truncate text-sm font-semibold">
                      {item && <ThemeSwatches tokens={item.tokens} />}
                      {item?.name ?? 'Indigo Classic'}
                    </p>
                  )}
                </div>
                <Button variant="secondary" size="sm" onClick={() => setPicker(scope)} disabled={!settings.data}>
                  Change
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {settings.isError && (
        <Card>
          <ErrorState message={getApiErrorMessage(settings.error, 'Could not load theme settings')} onRetry={() => settings.refetch()} />
        </Card>
      )}

      {/* Suggested: premium collection first, then essentials */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              Premium collection <Badge tone="primary"><Sparkles className="h-3 w-3" />New</Badge>
            </h2>
            <p className="text-sm text-muted-foreground">Curated themes with distinct moods, fonts and depth. Hover a card to see dark mode.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {presets.filter((p) => p.collection === 'premium').map(renderCard)}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Essentials</h2>
          <p className="text-sm text-muted-foreground">Professionally balanced everyday palettes with light and dark modes.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {presets.filter((p) => p.collection !== 'premium').map(renderCard)}
        </div>
      </section>

      {/* Custom */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">My themes</h2>
            <p className="text-sm text-muted-foreground">Custom themes saved to the platform library.</p>
          </div>
        </div>
        {custom.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1].map((i) => <Skeleton key={i} className="h-60 rounded-xl" />)}</div>
        ) : custom.isError ? (
          <Card><ErrorState message={getApiErrorMessage(custom.error, 'Could not load custom themes')} onRetry={() => custom.refetch()} /></Card>
        ) : customs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Palette />}
              title="No custom themes yet"
              description={`Start from ${current?.name ?? 'a suggested theme'} and make it yours: colors, sidebar, font, corner radius and shadows.`}
              action={
                <Button asChild size="sm">
                  <Link href={`/super-admin/themes/editor${settings.data ? `?from=${refParam(settings.data.superAdminTheme)}` : ''}`}>
                    <Plus /> Create theme
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{customs.map(renderCard)}</div>
        )}
      </section>

      {/* Picker */}
      <Modal
        open={picker !== null}
        onClose={() => setPicker(null)}
        busy={updateSettings.isPending}
        title={picker ? `Theme for ${SCOPES[picker].label.toLowerCase()}` : ''}
        description={picker ? SCOPES[picker].description : undefined}
        className="max-w-xl"
      >
        <div className="grid max-h-[55vh] grid-cols-2 gap-2.5 overflow-y-auto pr-1">
          {all.map((item) => {
            const selected = picker && settings.data ? sameRef(settings.data[picker], item.ref) : false;
            return (
              <button
                key={item.id}
                type="button"
                disabled={updateSettings.isPending}
                onClick={() => picker && !selected && assign(picker, item)}
                className={cn(
                  'group overflow-hidden rounded-lg border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-foreground/20',
                )}
              >
                <ThemeThumbnail tokens={item.tokens} className="h-20" />
                <span className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-2 text-[13px] font-medium">
                  <span className="truncate">{item.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        isLoading={deleteTheme.isPending}
        isDanger
        title="Delete theme?"
        description={`“${toDelete?.name}” will be removed from the library. This cannot be undone.`}
        confirmText="Delete theme"
      />
    </div>
  );
}

function ThemeCard({
  item,
  scopes,
  onApply,
  menu,
}: {
  item: LibraryItem;
  scopes: Scope[];
  onApply: () => void;
  menu: React.ComponentProps<typeof DropdownMenu>['items'];
}) {
  const [hover, setHover] = useState(false);
  const active = scopes.includes('superAdminTheme');

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-menu',
        active ? 'border-primary/60 ring-2 ring-primary/15' : 'border-border',
      )}
    >
      {/* Cover: generated art backdrop with the mini portal floating on it */}
      <ThemeArt tokens={item.tokens} seed={item.id} mode={hover ? 'dark' : 'light'} className="px-4 pt-4">
        {item.mood && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/80 px-2 py-0.5 text-2xs font-semibold text-zinc-800 shadow-sm backdrop-blur">
            {item.mood}
          </span>
        )}
        <span className="absolute right-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-2xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          Dark mode
        </span>
        <div className="mt-5 overflow-hidden rounded-t-lg border border-b-0 border-white/40 shadow-[0_-6px_24px_-6px_rgb(0_0_0/0.35)] transition-transform duration-300 group-hover:-translate-y-1">
          <ThemeThumbnail tokens={item.tokens} mode={hover ? 'dark' : 'light'} className="h-28 transition-colors duration-300" />
        </div>
      </ThemeArt>
      <div className="flex flex-1 flex-col border-t border-border p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.name}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {item.description || (item.custom ? `Updated ${formatRelative(item.custom.updatedAt)}` : '')}
            </p>
          </div>
          <DropdownMenu
            trigger={() => (
              <button aria-label={`Actions for ${item.name}`} className="-mr-1 rounded-md p-1 text-muted-foreground hover:bg-subtle hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}
            items={menu}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {scopes.includes('superAdminTheme') && <Badge tone="primary"><ShieldCheck className="h-3 w-3" />Portal</Badge>}
          {scopes.includes('defaultCompanyTheme') && <Badge tone="info"><Building2 className="h-3 w-3" />Company default</Badge>}
          {item.custom && <Badge>Custom</Badge>}
        </div>
        <div className="mt-auto pt-3">
          <Button size="sm" variant={active ? 'soft' : 'secondary'} className="w-full" disabled={active} onClick={onApply}>
            {active ? <><Check /> Active on portal</> : 'Apply to portal'}
          </Button>
        </div>
      </div>
    </div>
  );
}


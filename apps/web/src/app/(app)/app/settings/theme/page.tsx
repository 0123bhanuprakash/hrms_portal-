'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Lock, Palette, Redo2, RotateCcw, Sparkles, Undo2, Users } from 'lucide-react';
import type { ThemeRef, ThemeTokens } from '@hrms/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { SeasonsTab } from '@/components/season/seasons-tab';
import { rebrandTheme } from '@/lib/theme/generate';
import { isHex } from '@/lib/theme/color';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Tooltip } from '@/components/ui/tooltip';
import { ThemePicker } from '@/components/theme/theme-picker';
import { EmployeeChoicesCard } from '@/components/theme/employee-choices';
import { ThemeEditorPanels, useThemeHistory, useUndoShortcuts, useUnsavedGuard } from '@/components/theme/theme-editor';
import { useAuthStore } from '@/store/useAuthStore';
import { useAccess } from '@/lib/access/use-access';
import { companyThemeTokens, useCompanyBranding, useCompanyTheme, useUpdateCompanyTheme } from '@/lib/company/queries';
import { useThemeLibrary } from '@/lib/theme/library';
import { getApiErrorMessage } from '@/lib/errors';
import { stableStringify } from '@/lib/theme/color';

type Tab = 'look' | 'seasonal' | 'choices';

export default function CompanyThemePage() {
  return (
    <Suspense>
      <ThemePage />
    </Suspense>
  );
}

function ThemePage() {
  const { user, companyId } = useAuthStore();
  const { can } = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canEdit = Boolean(user?.isSuperAdmin || can('branding.manage'));
  const canSeason = Boolean(user?.isSuperAdmin || can('theme.seasonal'));
  const tabs = [
    ...(canEdit ? [{ id: 'look' as const, label: 'Look & colours', icon: <Palette /> }] : []),
    ...(canSeason ? [{ id: 'seasonal' as const, label: 'Seasonal', icon: <Sparkles /> }] : []),
    ...(canEdit ? [{ id: 'choices' as const, label: 'What employees can change', icon: <Users /> }] : []),
  ];
  const asked = params.get('tab') as Tab | null;
  const tab: Tab = tabs.find((t) => t.id === asked)?.id ?? tabs[0]?.id ?? 'look';

  if (!canEdit && !canSeason) {
    return (
      <Card>
        <EmptyState
          icon={<Lock />}
          title="Theme settings are managed by your administrators"
          description="Ask a Company Admin if you'd like the portal's look to change."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Settings"
        title="Theme"
        description="How your company portal looks for everyone — plus festival looks that switch on and back by themselves."
      />
      {tabs.length > 1 && (
        <Tabs<Tab> value={tab} onChange={(t) => router.replace(t === tabs[0]!.id ? pathname : `${pathname}?tab=${t}`, { scroll: false })} tabs={tabs} />
      )}
      <div key={tab} className="animate-fade-up">
        {tab === 'seasonal' ? <SeasonsTab /> : tab === 'choices' && companyId ? <EmployeeChoicesCard companyId={companyId} /> : <LookTab companyId={companyId} brand={params.get('primary')} />}
      </div>
    </div>
  );
}

function LookTab({ companyId, brand }: { companyId: string | null; brand: string | null }) {
  const theme = useCompanyTheme(companyId);
  if (theme.isLoading || !companyId) return <Skeleton className="h-[70vh] rounded-xl" />;
  if (theme.isError || !theme.data) {
    return <Card><ErrorState message={getApiErrorMessage(theme.error, 'Could not load your theme')} onRetry={() => theme.refetch()} /></Card>;
  }
  return (
    <CompanyThemeEditor
      key={companyId}
      companyId={companyId}
      initialTokens={companyThemeTokens(theme.data)!}
      initialSource={theme.data.themeSource ?? theme.data.platformDefault?.ref ?? null}
      usingPlatformDefault={!theme.data.themeTokens}
      brand={brand}
    />
  );
}

function CompanyThemeEditor({
  companyId,
  initialTokens,
  initialSource,
  usingPlatformDefault,
  brand,
}: {
  companyId: string;
  initialTokens: ThemeTokens;
  initialSource: ThemeRef | null;
  usingPlatformDefault: boolean;
  /** From Branding → "Make a theme from these": start from this main colour */
  brand?: string | null;
}) {
  const branding = useCompanyBranding(companyId);
  const update = useUpdateCompanyTheme(companyId);
  const library = useThemeLibrary({ includeCustom: false });

  const history = useThemeHistory(initialTokens);
  const tokens = history.present;
  const [source, setSource] = useState<ThemeRef | null>(initialSource);
  const [saved, setSaved] = useState(() => stableStringify(initialTokens));
  const [hasOwnTheme, setHasOwnTheme] = useState(!usingPlatformDefault);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRef, setPickerRef] = useState<ThemeRef | null>(initialSource);

  const dirty = stableStringify(tokens) !== saved;
  const fromBrand = useRef(false);
  useEffect(() => {
    if (!brand || fromBrand.current || !isHex(brand)) return;
    fromBrand.current = true;
    history.set(rebrandTheme(tokens, brand.toUpperCase()));
    setSource(null);
    toast.success('Started from your logo colours — review and publish when ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);
  useUnsavedGuard(dirty);
  useUndoShortcuts(history);

  const sourceName = library.find(source)?.name;

  const save = async () => {
    try {
      const result = await update.mutateAsync({ themeTokens: tokens, ...(source && { themeSource: source }) });
      setSaved(stableStringify(result.themeTokens));
      setHasOwnTheme(true);
      toast.success('Theme published — your portal has been updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save theme'));
    }
  };

  const startFrom = () => {
    const item = library.find(pickerRef);
    if (!item) return;
    history.set(item.tokens);
    setSource(item.ref);
    setPickerOpen(false);
    toast.success(`Started from ${item.name} — review and publish when ready`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{sourceName ? `Based on ${sourceName}` : 'Custom theme'}</span>
          {dirty ? (
            <Badge tone="warning" dot>Unpublished changes</Badge>
          ) : hasOwnTheme ? (
            <Badge tone="success" dot>Published</Badge>
          ) : (
            <Badge tone="info">Platform default</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" icon={<Palette />} onClick={() => { setPickerRef(source); setPickerOpen(true); }}>
            Start from a theme
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Tooltip content="Undo" shortcut="Ctrl Z">
            <Button variant="ghost" size="icon-sm" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo"><Undo2 /></Button>
          </Tooltip>
          <Tooltip content="Redo" shortcut="Ctrl ⇧ Z">
            <Button variant="ghost" size="icon-sm" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo"><Redo2 /></Button>
          </Tooltip>
          <Tooltip content="Discard unpublished changes">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Discard changes"
              disabled={!dirty}
              onClick={() => {
                history.reset(JSON.parse(saved) as ThemeTokens);
                setSource(initialSource);
              }}
            >
              <RotateCcw />
            </Button>
          </Tooltip>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" onClick={save} loading={update.isPending} disabled={update.isPending || (!dirty && hasOwnTheme)}>
            <Check /> Publish
          </Button>
        </div>
      </div>

      <ThemeEditorPanels
        tokens={tokens}
        onChange={history.set}
        companyName={branding.data?.displayName}
        previewNote="Preview only — your team sees the new look after you publish"
        before={hasOwnTheme ? (JSON.parse(saved) as ThemeTokens) : undefined}
      />

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Start from a theme"
        description="Replaces your current edits with a suggested theme. You can still fine-tune it before publishing."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={startFrom} disabled={!pickerRef}>Use this theme</Button>
          </>
        }
      >
        <div className="max-h-[52vh] overflow-y-auto pr-1">
          <ThemePicker items={library.items} value={pickerRef} onChange={(i) => setPickerRef(i.ref)} />
        </div>
      </Modal>
    </div>
  );
}

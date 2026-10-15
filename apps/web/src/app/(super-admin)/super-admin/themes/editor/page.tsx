'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, FileText, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import type { ThemeTokens } from '@hrms/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Section,
  ThemeEditorPanels,
  useThemeHistory,
  useUndoShortcuts,
  useUnsavedGuard,
} from '@/components/theme/theme-editor';
import { useCustomTheme, useSaveTheme, useThemeSettings, useUpdateThemeSettings } from '@/lib/admin/queries';
import { DEFAULT_PRESET, findPreset } from '@/lib/theme/presets';
import { getApiErrorMessage } from '@/lib/errors';
import { stableStringify } from '@/lib/theme/color';

export default function ThemeEditorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh] rounded-xl" />}>
      <ThemeEditorLoader />
    </Suspense>
  );
}

/** Resolves the starting point (?id= edit, ?from=preset:x|custom:id copy) before mounting the editor. */
function ThemeEditorLoader() {
  const params = useSearchParams();
  const id = params.get('id');
  const from = params.get('from') ?? '';
  const fromCustomId = from.startsWith('custom:') ? from.slice(7) : null;

  const editing = useCustomTheme(id);
  const source = useCustomTheme(fromCustomId);

  if ((id && editing.isLoading) || (fromCustomId && source.isLoading)) {
    return <Skeleton className="h-[70vh] rounded-xl" />;
  }
  if (id && editing.isLoadingError) {
    return <Card><ErrorState message={getApiErrorMessage(editing.error, 'Theme not found')} onRetry={() => editing.refetch()} /></Card>;
  }

  let initial: { name: string; description: string; tokens: ThemeTokens };
  if (id && editing.data) {
    initial = { name: editing.data.name, description: editing.data.description ?? '', tokens: editing.data.tokens };
  } else if (fromCustomId && source.data) {
    initial = { name: `${source.data.name} copy`, description: source.data.description ?? '', tokens: source.data.tokens };
  } else {
    const preset = findPreset(from.startsWith('preset:') ? from.slice(7) : '') ?? DEFAULT_PRESET;
    initial = { name: `${preset.name} (custom)`, description: '', tokens: preset.tokens };
  }

  return <ThemeEditor key={id ?? from} themeId={id} initial={initial} />;
}

function ThemeEditor({
  themeId,
  initial,
}: {
  themeId: string | null;
  initial: { name: string; description: string; tokens: ThemeTokens };
}) {
  const router = useRouter();
  const save = useSaveTheme();
  const updateSettings = useUpdateThemeSettings();
  const settings = useThemeSettings();

  const history = useThemeHistory(initial.tokens);
  const tokens = history.present;
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [savedSnapshot, setSavedSnapshot] = useState(() => stableStringify({ ...initial }));

  const dirty = stableStringify({ name, description, tokens }) !== savedSnapshot;
  const isActiveOnPortal =
    themeId !== null && settings.data?.superAdminTheme.kind === 'custom' && settings.data.superAdminTheme.id === themeId;

  useUnsavedGuard(dirty);
  useUndoShortcuts(history);

  const persist = async (apply: boolean) => {
    if (!name.trim()) {
      toast.error('Give your theme a name');
      return;
    }
    try {
      const saved = await save.mutateAsync({ id: themeId ?? undefined, name: name.trim(), description: description.trim() || null, tokens });
      setSavedSnapshot(stableStringify({ name: saved.name, description: saved.description ?? '', tokens: saved.tokens }));
      setName(saved.name);
      if (apply) {
        await updateSettings.mutateAsync({ superAdminTheme: { kind: 'custom', id: saved.id } });
      }
      toast.success(apply ? `“${saved.name}” saved and applied to the portal` : `“${saved.name}” saved`);
      if (!themeId) router.replace(`/super-admin/themes/editor?id=${saved.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save theme'));
    }
  };

  const busy = save.isPending || updateSettings.isPending;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="ghost" size="icon-sm" asChild aria-label="Back to themes">
          <Link href="/super-admin/themes"><ArrowLeft /></Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            aria-label="Theme name"
            className="h-8 max-w-xs border-transparent bg-transparent text-base font-semibold shadow-none hover:border-input focus-visible:border-ring"
          />
          {dirty ? <Badge tone="warning" dot>Unsaved</Badge> : themeId ? <Badge tone="success" dot>Saved</Badge> : null}
          {isActiveOnPortal && <Badge tone="primary">Active on portal</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="Undo" shortcut="Ctrl Z">
            <Button variant="ghost" size="icon-sm" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo"><Undo2 /></Button>
          </Tooltip>
          <Tooltip content="Redo" shortcut="Ctrl ⇧ Z">
            <Button variant="ghost" size="icon-sm" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo"><Redo2 /></Button>
          </Tooltip>
          <Tooltip content="Discard changes">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Reset"
              disabled={!dirty}
              onClick={() => {
                history.reset();
                setName(initial.name);
                setDescription(initial.description);
              }}
            >
              <RotateCcw />
            </Button>
          </Tooltip>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button variant="secondary" size="sm" onClick={() => persist(false)} loading={save.isPending && !updateSettings.isPending} disabled={busy || (!dirty && Boolean(themeId))}>
            Save
          </Button>
          <Button size="sm" onClick={() => persist(true)} loading={busy} disabled={busy || (isActiveOnPortal && !dirty)}>
            <Check /> Save & apply
          </Button>
        </div>
      </div>

      <ThemeEditorPanels
        tokens={tokens}
        onChange={history.set}
        previewNote="Live preview of a company portal · changes are not visible to anyone until you save & apply"
        extraSections={
          <Section title="Details" icon={<FileText />}>
            <label htmlFor="desc" className="mb-1.5 block text-[13px] font-medium">Description</label>
            <Input id="desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Shown in the theme library" />
          </Section>
        }
      />
    </div>
  );
}

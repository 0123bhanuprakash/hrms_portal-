'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Contrast,
  LayoutDashboard,
  Monitor,
  Moon,
  Palette,
  Redo2,
  RotateCcw,
  Shapes,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Type,
  Undo2,
  Users,
  Wand2,
  FileText,
} from 'lucide-react';
import type { ThemeFont, ThemePalette, ThemeShadow, ThemeTextScale, ThemeTokens } from '@hrms/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ColorInput, Input } from '@/components/ui/field';
import { Tooltip } from '@/components/ui/tooltip';
import { useCustomTheme, useSaveTheme, useThemeSettings, useUpdateThemeSettings } from '@/lib/admin/queries';
import { DEFAULT_PRESET, findPreset } from '@/lib/theme/presets';
import { buildTheme, generatePalette, type SidebarStyle } from '@/lib/theme/generate';
import { FONTS, SHADOW_OPTIONS, TEXT_SCALES } from '@/lib/theme/engine';
import { contrast, contrastGrade, ensureContrast, isHex, readableOn } from '@/lib/theme/color';
import type { PreviewPage } from '@/lib/theme/preview';
import { ThemePreviewFrame, type PreviewDevice } from '@/components/theme/theme-preview-frame';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Mode = 'light' | 'dark';
type Device = PreviewDevice;

const COLOR_GROUPS: Array<{ title: string; fields: Array<{ key: keyof ThemePalette; label: string; hint?: string }> }> = [
  {
    title: 'Surfaces',
    fields: [
      { key: 'background', label: 'Page background' },
      { key: 'surface', label: 'Cards & panels' },
      { key: 'border', label: 'Borders' },
    ],
  },
  {
    title: 'Text',
    fields: [
      { key: 'foreground', label: 'Primary text' },
      { key: 'mutedForeground', label: 'Secondary text' },
    ],
  },
  {
    title: 'Accent',
    fields: [
      { key: 'primary', label: 'Primary', hint: 'Buttons, links, focus, active states' },
      { key: 'primaryForeground', label: 'Text on primary' },
    ],
  },
  {
    title: 'Sidebar',
    fields: [
      { key: 'sidebar', label: 'Background' },
      { key: 'sidebarForeground', label: 'Text' },
      { key: 'sidebarActive', label: 'Active item' },
    ],
  },
  {
    title: 'Status',
    fields: [
      { key: 'success', label: 'Success' },
      { key: 'warning', label: 'Warning' },
      { key: 'danger', label: 'Danger' },
      { key: 'info', label: 'Info' },
    ],
  },
];

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
  if (id && editing.isError) {
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

// ─── History (undo / redo) ───────────────────────────────

function useHistory(initial: ThemeTokens) {
  const [stack, setStack] = useState<{ items: ThemeTokens[]; index: number }>({ items: [initial], index: 0 });
  const lastPush = useRef(0);

  const present = stack.items[stack.index]!;

  /** Rapid edits (e.g. dragging a color picker) within 500ms merge into one undo step. */
  const set = useCallback((next: ThemeTokens) => {
    const now = Date.now();
    const coalesce = now - lastPush.current < 500;
    lastPush.current = now;
    setStack((s) => {
      const base = s.items.slice(0, s.index + (coalesce && s.index > 0 ? 0 : 1));
      const items = [...base, next].slice(-100);
      return { items, index: items.length - 1 };
    });
  }, []);

  const undo = useCallback(() => setStack((s) => ({ ...s, index: Math.max(0, s.index - 1) })), []);
  const redo = useCallback(() => setStack((s) => ({ ...s, index: Math.min(s.items.length - 1, s.index + 1) })), []);
  const reset = useCallback(() => setStack({ items: [initial], index: 0 }), [initial]);

  return { present, set, undo, redo, reset, canUndo: stack.index > 0, canRedo: stack.index < stack.items.length - 1 };
}

// ─── Editor ──────────────────────────────────────────────

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

  const history = useHistory(initial.tokens);
  const tokens = history.present;
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ ...initial }));
  const [mode, setMode] = useState<Mode>('light');
  const [page, setPage] = useState<PreviewPage>('dashboard');
  const [device, setDevice] = useState<Device>('desktop');
  const [brand, setBrand] = useState(initial.tokens.light.primary);
  const [sidebarStyle, setSidebarStyle] = useState<SidebarStyle>('light');

  const dirty = JSON.stringify({ name, description, tokens }) !== savedSnapshot;
  const isActiveOnPortal =
    themeId !== null && settings.data?.superAdminTheme.kind === 'custom' && settings.data.superAdminTheme.id === themeId;

  // ── Guards & shortcuts ──────────────────────────────────
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName) && (target as HTMLInputElement).type !== 'range') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [history]);

  // ── Mutations ───────────────────────────────────────────
  const setColor = (key: keyof ThemePalette, value: string) => {
    if (!isHex(value)) return;
    history.set({ ...tokens, [mode]: { ...tokens[mode], [key]: value } });
  };

  const generate = () => {
    if (!isHex(brand)) return;
    const next = buildTheme({
      primary: brand,
      sidebar: sidebarStyle,
      font: tokens.typography.font,
      scale: tokens.typography.scale,
      radius: tokens.shape.radius,
      shadow: tokens.shape.shadow,
    });
    history.set(next);
    toast.success('Palette generated for light and dark mode');
  };

  const applySidebarStyle = (style: SidebarStyle) => {
    setSidebarStyle(style);
    const pick = (m: Mode) => {
      const g = generatePalette(tokens[m].primary, m, style);
      return { sidebar: g.sidebar, sidebarForeground: g.sidebarForeground, sidebarActive: g.sidebarActive };
    };
    history.set({ ...tokens, light: { ...tokens.light, ...pick('light') }, dark: { ...tokens.dark, ...pick('dark') } });
  };

  const persist = async (apply: boolean) => {
    if (!name.trim()) {
      toast.error('Give your theme a name');
      return;
    }
    try {
      const saved = await save.mutateAsync({ id: themeId ?? undefined, name: name.trim(), description: description.trim() || null, tokens });
      setSavedSnapshot(JSON.stringify({ name: saved.name, description: saved.description ?? '', tokens: saved.tokens }));
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
  const palette = tokens[mode];

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
          {dirty ? (
            <Badge tone="warning" dot>Unsaved</Badge>
          ) : themeId ? (
            <Badge tone="success" dot>Saved</Badge>
          ) : null}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,360px)_1fr]">
        {/* ── Controls ───────────────────────────── */}
        <div className="space-y-3">
          <Section title="Quick start" icon={<Wand2 />} defaultOpen>
            <p className="text-xs text-muted-foreground">Pick a brand color — a complete, accessible light and dark palette is generated for you.</p>
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1.5 block text-[13px] font-medium" htmlFor="brand">Brand color</label>
                <ColorInput id="brand" value={brand} onChange={setBrand} />
              </div>
              <Button onClick={generate} disabled={!isHex(brand)} icon={<Sparkles />}>Generate</Button>
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-[13px] font-medium">Sidebar style</p>
              <Segmented
                value={sidebarStyle}
                onChange={applySidebarStyle}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'brand', label: 'Brand' },
                ]}
              />
            </div>
          </Section>

          <Section
            title="Colors"
            icon={<Palette />}
            defaultOpen
            aside={
              <Segmented
                size="sm"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'light', label: 'Light', icon: <Sun /> },
                  { value: 'dark', label: 'Dark', icon: <Moon /> },
                ]}
              />
            }
          >
            <div className="space-y-5">
              {COLOR_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
                  <div className="space-y-2">
                    {group.fields.map((f) => (
                      <ColorRow key={`${mode}-${f.key}`} label={f.label} hint={f.hint} value={palette[f.key]} onChange={(v) => setColor(f.key, v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Typography" icon={<Type />}>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FONTS) as ThemeFont[]).map((font) => (
                <OptionTile
                  key={font}
                  selected={tokens.typography.font === font}
                  onClick={() => history.set({ ...tokens, typography: { ...tokens.typography, font } })}
                >
                  <span className="block text-lg font-semibold leading-none">Aa</span>
                  <span className="mt-1.5 block truncate text-xs text-muted-foreground">{FONTS[font].label}</span>
                </OptionTile>
              ))}
            </div>
            <p className="mb-1.5 mt-4 text-[13px] font-medium">Text size</p>
            <Segmented
              value={tokens.typography.scale}
              onChange={(scale: ThemeTextScale) => history.set({ ...tokens, typography: { ...tokens.typography, scale } })}
              options={(Object.keys(TEXT_SCALES) as ThemeTextScale[]).map((s) => ({ value: s, label: TEXT_SCALES[s].label }))}
            />
          </Section>

          <Section title="Shape & depth" icon={<Shapes />}>
            <div className="flex items-center justify-between">
              <label htmlFor="radius" className="text-[13px] font-medium">Corner radius</label>
              <span className="font-mono text-xs text-muted-foreground">{tokens.shape.radius}px</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="radius"
                type="range"
                min={0}
                max={20}
                value={tokens.shape.radius}
                onChange={(e) => history.set({ ...tokens, shape: { ...tokens.shape, radius: Number(e.target.value) } })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[hsl(var(--primary))]"
              />
              <span className="h-8 w-8 shrink-0 border-2 border-primary bg-primary-soft" style={{ borderRadius: tokens.shape.radius }} />
            </div>
            <p className="mb-1.5 mt-4 text-[13px] font-medium">Shadows</p>
            <Segmented
              value={tokens.shape.shadow}
              onChange={(shadow: ThemeShadow) => history.set({ ...tokens, shape: { ...tokens.shape, shadow } })}
              options={(Object.keys(SHADOW_OPTIONS) as ThemeShadow[]).map((s) => ({ value: s, label: SHADOW_OPTIONS[s].label }))}
            />
          </Section>

          <Section title="Accessibility" icon={<Contrast />} defaultOpen>
            <ContrastChecks palette={palette} mode={mode} onFix={setColor} />
          </Section>

          <Section title="Details" icon={<FileText />}>
            <label htmlFor="desc" className="mb-1.5 block text-[13px] font-medium">Description</label>
            <Input id="desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Shown in the theme library" />
          </Section>
        </div>

        {/* ── Preview ────────────────────────────── */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <Segmented
                size="sm"
                value={page}
                onChange={setPage}
                options={[
                  { value: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
                  { value: 'people', label: 'People', icon: <Users /> },
                  { value: 'form', label: 'Form', icon: <FileText /> },
                ]}
              />
              <div className="flex items-center gap-2">
                <Segmented
                  size="sm"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'light', label: '', icon: <Sun />, aria: 'Light preview' },
                    { value: 'dark', label: '', icon: <Moon />, aria: 'Dark preview' },
                  ]}
                />
                <Segmented
                  size="sm"
                  value={device}
                  onChange={setDevice}
                  options={[
                    { value: 'desktop', label: '', icon: <Monitor />, aria: 'Desktop' },
                    { value: 'tablet', label: '', icon: <Tablet />, aria: 'Tablet' },
                    { value: 'mobile', label: '', icon: <Smartphone />, aria: 'Mobile' },
                  ]}
                />
              </div>
            </div>
            <ThemePreviewFrame tokens={tokens} mode={mode} page={page} device={device} />
          </Card>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Live preview of a company portal · changes are not visible to anyone until you save &amp; apply
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────

function Section({
  title,
  icon,
  aside,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  aside?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex flex-1 items-center gap-2.5 text-left">
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
          <span className="flex-1 text-sm font-semibold">{title}</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
        </button>
        {open && aside}
      </div>
      {open && <div className="border-t border-border px-4 py-4 animate-in fade-in-0">{children}</div>}
    </Card>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: React.ReactNode; aria?: string }>;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-md border border-border bg-muted p-0.5', size === 'md' && 'w-full')}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.aria ?? o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius)-4px)] font-medium transition-all [&_svg]:size-3.5',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
              selected ? 'bg-surface text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function OptionTile({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-primary-soft/50 ring-1 ring-primary/30' : 'border-border hover:border-foreground/20 hover:bg-muted/50',
      )}
    >
      {selected && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />}
      {children}
    </button>
  );
}

function ColorRow({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] text-foreground">{label}</p>
        {hint && <p className="truncate text-2xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="w-[150px] shrink-0">
        <ColorInput
          value={draft}
          onChange={(v) => {
            setDraft(v);
            if (isHex(v)) onChange(v);
          }}
        />
      </div>
    </div>
  );
}

/** WCAG checks for the most important pairs, with a one-click fix. */
function ContrastChecks({
  palette,
  mode,
  onFix,
}: {
  palette: ThemePalette;
  mode: Mode;
  onFix: (key: keyof ThemePalette, value: string) => void;
}) {
  const checks = useMemo(
    () => [
      { label: 'Text on background', fg: palette.foreground, bg: palette.background, key: 'foreground' as const, target: 4.5 },
      { label: 'Text on cards', fg: palette.foreground, bg: palette.surface, key: 'foreground' as const, target: 4.5 },
      { label: 'Secondary text', fg: palette.mutedForeground, bg: palette.surface, key: 'mutedForeground' as const, target: 4.5 },
      { label: 'Primary button', fg: palette.primaryForeground, bg: palette.primary, key: 'primaryForeground' as const, target: 4.5 },
      { label: 'Sidebar text', fg: palette.sidebarForeground, bg: palette.sidebar, key: 'sidebarForeground' as const, target: 4.5 },
      { label: 'Links & accents', fg: palette.primary, bg: palette.surface, key: 'primary' as const, target: 3 },
    ],
    [palette],
  );

  const failing = checks.filter((c) => contrast(c.fg, c.bg) < c.target).length;

  return (
    <div>
      <p className={cn('mb-3 flex items-center gap-2 text-xs', failing ? 'text-warning' : 'text-success')}>
        {failing ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        {failing ? `${failing} pair${failing > 1 ? 's' : ''} below WCAG AA in ${mode} mode` : `All key pairs pass WCAG AA in ${mode} mode`}
      </p>
      <ul className="space-y-1.5">
        {checks.map((c) => {
          const ratio = contrast(c.fg, c.bg);
          const grade = contrastGrade(ratio);
          const pass = ratio >= c.target;
          return (
            <li key={c.label} className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-1.5">
              <span
                className="flex h-6 w-9 shrink-0 items-center justify-center rounded text-[11px] font-semibold"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                Aa
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">{c.label}</span>
              <span className="font-mono text-2xs text-muted-foreground">{ratio.toFixed(1)}:1</span>
              <Badge tone={pass ? 'success' : 'danger'} className="px-1.5 py-0 text-2xs">{pass ? grade : 'Fail'}</Badge>
              {!pass && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-2xs"
                  onClick={() =>
                    onFix(c.key, c.key === 'primaryForeground' ? readableOn(c.bg) : ensureContrast(c.fg, c.bg, c.target))
                  }
                >
                  Fix
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

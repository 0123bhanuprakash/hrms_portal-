'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Contrast,
  FileText,
  LayoutDashboard,
  Monitor,
  Moon,
  Palette,
  Shapes,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Type,
  Users,
  Wand2,
} from 'lucide-react';
import type { ThemeFont, ThemePalette, ThemeShadow, ThemeTextScale, ThemeTokens } from '@hrms/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import { ColorInput } from '@/components/ui/field';
import { ThemePreviewFrame, type PreviewDevice } from './theme-preview-frame';
import { buildTheme, detectSidebarStyle, generatePalette, type SidebarStyle } from '@/lib/theme/generate';
import { FONTS, SHADOW_OPTIONS, TEXT_SCALES } from '@/lib/theme/engine';
import { contrast, contrastGrade, ensureContrast, isHex, readableOn } from '@/lib/theme/color';
import type { PreviewPage } from '@/lib/theme/preview';
import { cn } from '@/lib/cn';

// ============================================================
// Shared theme editor (Super Admin Theme Studio + Company Admin
// theme settings): editing panels, live preview, undo history and
// unsaved-changes guard. Saving is left to the hosting page.
// ============================================================

type Mode = 'light' | 'dark';

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

// ─── Hooks ────────────────────────────────────────────────

/** Undo/redo stack. Rapid edits (e.g. dragging a color picker) within 500ms merge into one step. */
export function useThemeHistory(initial: ThemeTokens) {
  const [stack, setStack] = useState<{ items: ThemeTokens[]; index: number }>({ items: [initial], index: 0 });
  const lastPush = useRef(0);

  const present = stack.items[stack.index]!;

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
  /** Start a fresh history (e.g. after loading or discarding changes). */
  const reset = useCallback((tokens: ThemeTokens = initial) => setStack({ items: [tokens], index: 0 }), [initial]);

  return { present, set, undo, redo, reset, canUndo: stack.index > 0, canRedo: stack.index < stack.items.length - 1 };
}

/** Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (ignored while typing in text fields). */
export function useUndoShortcuts(history: { undo: () => void; redo: () => void }) {
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
}

/** Browser warning when leaving with unsaved changes. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

// ─── Editor panels ────────────────────────────────────────

/**
 * Controls (quick start, colors, typography, shape, accessibility) on the
 * left and a live preview on the right. `extraSections` are appended to the
 * controls column (e.g. name/description in the Theme Studio).
 */
export function ThemeEditorPanels({
  tokens,
  onChange,
  extraSections,
  companyName,
  previewNote,
  before,
}: {
  tokens: ThemeTokens;
  onChange: (tokens: ThemeTokens) => void;
  extraSections?: React.ReactNode;
  companyName?: string;
  previewNote?: React.ReactNode;
  /** The published theme: enables the before / after slider */
  before?: ThemeTokens;
}) {
  const [mode, setMode] = useState<Mode>('light');
  /** One mode, light + dark side by side, or before / after */
  const [view, setView] = useState<'one' | 'both' | 'compare'>('one');
  const [split, setSplit] = useState(50);
  const [page, setPage] = useState<PreviewPage>('dashboard');
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [brand, setBrand] = useState(tokens.light.primary);
  const [sidebarStyle, setSidebarStyle] = useState<SidebarStyle>(() => detectSidebarStyle(tokens));

  const palette = tokens[mode];

  // Keep Quick start in sync when the theme is replaced from outside
  // (undo/redo, "Start from a theme", discard changes).
  useEffect(() => {
    setBrand(tokens.light.primary);
    setSidebarStyle(detectSidebarStyle(tokens));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.light.primary, tokens.light.sidebar]);

  const setColor = (key: keyof ThemePalette, value: string) => {
    if (!isHex(value)) return;
    onChange({ ...tokens, [mode]: { ...tokens[mode], [key]: value } });
  };

  const generate = () => {
    if (!isHex(brand)) return;
    onChange(
      buildTheme({
        primary: brand,
        sidebar: sidebarStyle,
        font: tokens.typography.font,
        scale: tokens.typography.scale,
        radius: tokens.shape.radius,
        shadow: tokens.shape.shadow,
      }),
    );
    toast.success('Palette generated for light and dark mode');
  };

  const applySidebarStyle = (style: SidebarStyle) => {
    setSidebarStyle(style);
    const pick = (m: Mode) => {
      const g = generatePalette(tokens[m].primary, m, style);
      return { sidebar: g.sidebar, sidebarForeground: g.sidebarForeground, sidebarActive: g.sidebarActive };
    };
    onChange({ ...tokens, light: { ...tokens.light, ...pick('light') }, dark: { ...tokens.dark, ...pick('dark') } });
  };

  return (
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
                onClick={() => onChange({ ...tokens, typography: { ...tokens.typography, font } })}
              >
                <span className="block text-lg font-semibold leading-none">Aa</span>
                <span className="mt-1.5 block truncate text-xs text-muted-foreground">{FONTS[font].label}</span>
              </OptionTile>
            ))}
          </div>
          <p className="mb-1.5 mt-4 text-[13px] font-medium">Text size</p>
          <Segmented
            value={tokens.typography.scale}
            onChange={(scale: ThemeTextScale) => onChange({ ...tokens, typography: { ...tokens.typography, scale } })}
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
              onChange={(e) => onChange({ ...tokens, shape: { ...tokens.shape, radius: Number(e.target.value) } })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[hsl(var(--primary))]"
            />
            <span className="h-8 w-8 shrink-0 border-2 border-primary bg-primary-soft" style={{ borderRadius: tokens.shape.radius }} />
          </div>
          <p className="mb-1.5 mt-4 text-[13px] font-medium">Shadows</p>
          <Segmented
            value={tokens.shape.shadow}
            onChange={(shadow: ThemeShadow) => onChange({ ...tokens, shape: { ...tokens.shape, shadow } })}
            options={(Object.keys(SHADOW_OPTIONS) as ThemeShadow[]).map((s) => ({ value: s, label: SHADOW_OPTIONS[s].label }))}
          />
        </Section>

        <Section title="Accessibility" icon={<Contrast />} defaultOpen>
          <ContrastChecks palette={palette} mode={mode} onFix={setColor} />
        </Section>

        {extraSections}
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
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: 'one', label: 'One', aria: 'One preview' },
                  { value: 'both', label: 'Light + dark', aria: 'Light and dark side by side' },
                  ...(before ? [{ value: 'compare' as const, label: 'Before / after', aria: 'Before and after' }] : []),
                ]}
              />
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
          {view === 'both' ? (
            <div className="grid grid-cols-2 gap-px bg-border">
              <ThemePreviewFrame tokens={tokens} mode="light" page={page} device={device} companyName={companyName} height={520} />
              <ThemePreviewFrame tokens={tokens} mode="dark" page={page} device={device} companyName={companyName} height={520} />
            </div>
          ) : view === 'compare' && before ? (
            <div className="relative">
              <ThemePreviewFrame tokens={before} mode={mode} page={page} device={device} companyName={companyName} />
              <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
                <ThemePreviewFrame tokens={tokens} mode={mode} page={page} device={device} companyName={companyName} />
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground/80" style={{ left: `${split}%` }}>
                <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-surface shadow" />
              </div>
              <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-semibold shadow">Published</span>
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow">Your edit</span>
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(e) => setSplit(+e.target.value)}
                aria-label="Move the before / after line"
                className="absolute inset-x-0 bottom-0 h-full w-full cursor-ew-resize opacity-0"
              />
            </div>
          ) : (
            <ThemePreviewFrame tokens={tokens} mode={mode} page={page} device={device} companyName={companyName} />
          )}
        </Card>
        {previewNote && <p className="mt-2 text-center text-xs text-muted-foreground">{previewNote}</p>}
      </div>
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────

export function Section({
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

export function Segmented<T extends string>({
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
              <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded text-[11px] font-semibold" style={{ backgroundColor: c.bg, color: c.fg }}>
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
                  onClick={() => onFix(c.key, c.key === 'primaryForeground' ? readableOn(c.bg) : ensureContrast(c.fg, c.bg, c.target))}
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

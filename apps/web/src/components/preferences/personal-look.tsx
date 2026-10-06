'use client';

import React from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import type { BackdropLevel, BackdropPack, MenuStyle, ThemeTokens } from '@hrms/types';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { ThemeThumbnail } from '@/components/theme/theme-card';
import { useAuthStore } from '@/store/useAuthStore';
import { companyThemeTokens, useCompanyTheme, usePreferences, useUpdatePreferences, type UserPreferences } from '@/lib/company/queries';
import { THEME_PRESETS } from '@/lib/theme/presets';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { useResetUiState } from '@/lib/preferences/ui-state';
import { MOMENT_GROUPS, useMomentsOff } from '@/components/motion/moments';
import { cn } from '@/lib/cn';
import { Backdrop } from '@/components/motion/page-backdrop';
import { BACKDROP_LEVEL_INFO, BACKDROP_PACK_INFO } from '@/lib/preferences/backdrop';

// ============================================================
// An employee's own colour theme and menu style — only what the
// company allows (Settings → Theme → What employees can change).
// Choices save straight away.
// ============================================================

export const MENU_STYLE_INFO: Record<MenuStyle, { label: string; text: string }> = {
  classic: { label: 'Classic', text: 'The full menu with every section open' },
  glide: { label: 'Glide', text: 'A floating card that folds to icons' },
  peek: { label: 'Peek', text: 'Icons that open over the page on hover' },
  floating: { label: 'Floating', text: 'A rounded card with a quick menu search' },
  collapsible: { label: 'Collapsible', text: 'Sections fold away; yours stays open' },
};

function usePersonalSave() {
  const update = useUpdatePreferences();
  const save = async (body: Partial<UserPreferences>, done: string) => {
    try {
      await update.mutateAsync(body);
      toast.success(done);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save your choice'));
    }
  };
  return { save, pending: update.isPending };
}

function Tile({ selected, onClick, disabled, children, label }: { selected: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative flex flex-col gap-2 rounded-lg border p-2 text-left text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        selected ? 'border-primary bg-primary-soft/40 ring-1 ring-primary/30' : 'border-border hover:border-foreground/20',
      )}
    >
      {selected && (
        <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      {children}
    </button>
  );
}

/** Pick one of the built-in themes, or follow the company theme. */
export function ColourThemeCard() {
  const companyId = useAuthStore((s) => s.companyId);
  const theme = useCompanyTheme(companyId);
  const prefs = usePreferences();
  const { save, pending } = usePersonalSave();
  const rules = theme.data?.personalization;

  if (theme.isLoading || prefs.isLoading) {
    return (
      <Card>
        <CardHeader title="Colour theme" />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      </Card>
    );
  }
  if (!rules?.personalThemes) return null;

  const offered = THEME_PRESETS.filter((p) => !rules.allowedThemes.length || rules.allowedThemes.includes(p.key));
  const current = prefs.data?.colorTheme && offered.some((p) => p.key === prefs.data?.colorTheme) ? prefs.data.colorTheme : null;
  const companyTokens: ThemeTokens | null = companyThemeTokens(theme.data);

  return (
    <Card>
      <CardHeader title="Colour theme" description="Your own colours for the portal. Only you see them; light and dark mode still apply." />
      <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Company default" selected={current === null} disabled={pending} onClick={() => current !== null && save({ colorTheme: null }, 'Back to the company theme')}>
          {companyTokens && <ThemeThumbnail tokens={companyTokens} className="h-20 w-full rounded-md border border-border" />}
          <span className="px-0.5">
            <span className="block font-semibold">Company default</span>
            <span className="block text-xs text-muted-foreground">Follows your company</span>
          </span>
        </Tile>
        {offered.map((p) => (
          <Tile key={p.key} label={p.name} selected={current === p.key} disabled={pending} onClick={() => current !== p.key && save({ colorTheme: p.key }, `${p.name} theme on`)}>
            <ThemeThumbnail tokens={p.tokens} className="h-20 w-full rounded-md border border-border" />
            <span className="px-0.5">
              <span className="block truncate font-semibold">{p.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{p.mood ?? (p.collection === 'premium' ? 'Premium' : 'Essentials')}</span>
            </span>
          </Tile>
        ))}
      </div>
    </Card>
  );
}

/** Small drawing of each menu style. */
export function MenuStyleSketch({ style }: { style: MenuStyle }) {
  const line = (w: string, on = false) => <span className={cn('block h-1.5 rounded-full', on ? 'bg-primary' : 'bg-muted-foreground/30')} style={{ width: w }} />;
  return (
    <span className="flex h-20 w-full overflow-hidden rounded-md border border-border bg-canvas" aria-hidden>
      {style === 'glide' ? (
        <span className="m-1.5 flex w-14 flex-col gap-1 rounded-lg border border-border bg-sidebar p-1.5 shadow-card">
          {line('70%')}
          {line('80%', true)}
          <span className="ml-1.5 flex flex-col gap-1 border-l border-border pl-1.5">{line('85%')}{line('70%')}</span>
          {line('60%')}
        </span>
      ) : style === 'peek' ? (
        <span className="relative flex w-6 flex-col items-center gap-1.5 bg-sidebar py-2">
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className={cn('h-2.5 w-2.5 rounded-sm', i === 1 ? 'bg-primary' : 'bg-muted-foreground/30')} />)}
          <span className="absolute left-full top-4 ml-0.5 flex w-11 flex-col gap-1 rounded-md bg-sidebar p-1.5 shadow-dialog">{line('85%', true)}{line('70%')}{line('80%')}</span>
        </span>
      ) : style === 'floating' ? (
        <span className="m-1.5 flex w-14 flex-col gap-1.5 rounded-lg bg-sidebar p-1.5 shadow-card">
          <span className="block h-2 rounded-full bg-muted-foreground/20" />
          {line('80%')}
          <span className="block h-2 rounded-full bg-primary/70" />
          {line('70%')}
          {line('85%')}
        </span>
      ) : style === 'collapsible' ? (
        <span className="flex w-16 flex-col gap-1.5 bg-sidebar p-2">
          {line('75%')}
          <span className="ml-1.5 flex flex-col gap-1 border-l border-border pl-1.5">{line('80%', true)}{line('65%')}</span>
          {line('70%')}
          {line('60%')}
        </span>
      ) : (
        <span className="flex w-16 flex-col gap-1.5 bg-sidebar p-2">
          {line('45%')}
          {line('80%', true)}
          {line('70%')}
          {line('45%')}
          {line('75%')}
        </span>
      )}
      <span className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="block h-2 w-1/2 rounded-full bg-muted-foreground/30" />
        <span className="grid flex-1 grid-cols-2 gap-1.5">
          <span className="rounded bg-surface ring-1 ring-border" />
          <span className="rounded bg-surface ring-1 ring-border" />
        </span>
      </span>
    </span>
  );
}

/**
 * Pick how the side menu looks (desktop; phones keep the slide-out menu).
 * `platform`: the Super Admin console — no company rules, Classic is the default.
 */
export function MenuStyleCard({ platform = false }: { platform?: boolean }) {
  const companyId = useAuthStore((s) => s.companyId);
  const theme = useCompanyTheme(platform ? null : companyId);
  const prefs = usePreferences();
  const { save, pending } = usePersonalSave();
  const rules = theme.data?.personalization;
  if ((!platform && !rules?.personalMenuStyle) || !prefs.data) return null;

  const current = prefs.data.menuStyle ?? null;
  const fallback: MenuStyle = platform ? 'classic' : rules!.defaultMenuStyle;
  return (
    <Card>
      <CardHeader title="Menu style" description={`How the side menu looks on larger screens. ${platform ? 'Default' : 'Company default'}: ${MENU_STYLE_INFO[fallback].label}.`} />
      <div role="radiogroup" aria-label="Menu style" className="grid grid-cols-2 gap-3 px-5 pb-5 lg:grid-cols-4">
        {(Object.keys(MENU_STYLE_INFO) as MenuStyle[]).map((style) => {
          const selected = (current ?? fallback) === style;
          return (
            <Tile
              key={style}
              label={MENU_STYLE_INFO[style].label}
              selected={selected}
              disabled={pending}
              onClick={() => !selected && save({ menuStyle: style === fallback ? null : style }, `${MENU_STYLE_INFO[style].label} menu on`)}
            >
              <MenuStyleSketch style={style} />
              <span className="px-0.5">
                <span className="block font-semibold">
                  {MENU_STYLE_INFO[style].label}
                  {style === fallback && <span className="ml-1.5 text-2xs font-medium text-muted-foreground">Default</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{MENU_STYLE_INFO[style].text}</span>
              </span>
            </Tile>
          );
        })}
      </div>
    </Card>
  );
}

/** What the portal remembers for you, and a way to start fresh. */
export function SavedViewsCard() {
  const prefs = usePreferences();
  const reset = useResetUiState();
  const count = Object.keys(prefs.data?.uiState ?? {}).length;
  return (
    <Card>
      <CardHeader
        title="Remembered views"
        description="Chart styles, open menu sections and calendar views you pick are saved on your account, so they follow you to any computer. Searches, filters and page numbers start fresh each time."
      />
      <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
        <span className="text-sm text-muted-foreground">{count ? `${count} saved choice${count === 1 ? '' : 's'}` : 'Nothing saved yet — you’re using your company’s defaults.'}</span>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          disabled={!count}
          loading={reset.isPending}
          onClick={async () => {
            try {
              await reset.mutateAsync();
              toast.success('Back to your company’s default views');
            } catch (err) {
              toast.error(getApiErrorMessage(err, 'Could not reset'));
            }
          }}
        >
          Reset to company defaults
        </Button>
      </div>
    </Card>
  );
}

const PREVIEWS: Array<{ kind: string; label: string }> = [
  { kind: 'birthday', label: 'Birthday' },
  { kind: 'anniversary', label: 'Anniversary' },
  { kind: 'diwali', label: 'Diwali' },
  { kind: 'holi', label: 'Holi' },
  { kind: 'christmas', label: 'Christmas' },
  { kind: 'newyear', label: 'New Year' },
  { kind: 'monsoon', label: 'Monsoon' },
  { kind: 'friday', label: 'Friday' },
  { kind: 'office', label: 'Office lights' },
];

/**
 * Atmosphere moments in the home hero: switch groups off, or preview one.
 * `platform`: the Super Admin console — no personal dates or office lights there.
 */
export function MomentsCard({ platform = false }: { platform?: boolean }) {
  const [off, setOff] = useMomentsOff();
  const groups = platform ? MOMENT_GROUPS.filter((g) => g.key !== 'personal' && g.key !== 'office') : MOMENT_GROUPS;
  const previews = platform ? PREVIEWS.filter((p) => !['birthday', 'anniversary', 'office'].includes(p.kind)) : PREVIEWS;
  const home = platform ? '/super-admin' : '/app';
  return (
    <Card>
      <CardHeader
        title="Moments on your home page"
        description={
          platform
            ? 'Small touches in the sky at the top of the dashboard — festivals, the monsoon, Friday afternoons. Everything else is the sky by time of day.'
            : 'Small celebrations in the sky at the top of Home — your birthday, festivals, the monsoon, Friday afternoons. The biggest moment of the day wins; everything else is the sky by time of day.'
        }
      />
      <div className="divide-y divide-border border-t border-border">
        {groups.map((g) => {
          const on = !off.includes(g.key);
          return (
            <label key={g.key} className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm">
              <span className="flex-1">{g.label}</span>
              <input
                type="checkbox"
                role="switch"
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                checked={on}
                onChange={() => setOff(on ? [...off, g.key] : off.filter((k) => k !== g.key))}
                aria-label={g.label}
              />
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-5 py-3">
        <span className="mr-1 text-xs text-muted-foreground">Preview:</span>
        {previews.map((p) => (
          <a key={p.kind} href={`${home}?moment=${p.kind}`} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-subtle">
            {p.label}
          </a>
        ))}
      </div>
    </Card>
  );
}

/**
 * The living background behind each page: which style (pack), and how lively.
 * `platform`: the Super Admin console — no company defaults.
 */
export function BackdropCard({ platform = false }: { platform?: boolean }) {
  const companyId = useAuthStore((s) => s.companyId);
  const theme = useCompanyTheme(platform ? null : companyId);
  const prefs = usePreferences();
  const { save, pending } = usePersonalSave();
  if (!prefs.data) return null;
  const rules = theme.data?.personalization;
  const packDefault: BackdropPack = (!platform && rules?.defaultBackdropPack) || 'signature';
  const levelDefault: BackdropLevel = (!platform && rules?.defaultBackdropLevel) || 'lively';
  const pack = prefs.data.backdropPack ?? packDefault;
  const level = prefs.data.backdropLevel ?? levelDefault;
  const def = platform ? 'Default' : 'Company default';
  const choosePack = (p: BackdropPack) => save({ backdropPack: p === packDefault ? null : p }, p === 'simple' ? 'Plain backgrounds on' : `${BACKDROP_PACK_INFO[p].label} backgrounds on`);

  return (
    <Card>
      <CardHeader
        title="Page backgrounds"
        description={`A soft, living background behind every page — each style has its own mood for every section (Home, People, Leave, Expenses…). ${def}: ${BACKDROP_PACK_INFO[packDefault].label}${packDefault === 'simple' ? '' : `, ${BACKDROP_LEVEL_INFO[levelDefault].label.toLowerCase()}`}.`}
      />
      <div className="space-y-4 px-5 pb-5">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Style</p>
          <div role="radiogroup" aria-label="Background style" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(Object.keys(BACKDROP_PACK_INFO) as BackdropPack[]).map((p) => (
              <Tile key={p} label={BACKDROP_PACK_INFO[p].label} selected={pack === p} disabled={pending} onClick={() => pack !== p && choosePack(p)}>
                <span className="relative isolate block h-20 overflow-hidden rounded-md border border-border bg-background">
                  <Backdrop mood="aurora" pack={p} contained level={level === 'off' ? 'calm' : level} timeZone={prefs.data.timezone} />
                </span>
                <span className="px-0.5">
                  <span className="block font-semibold">
                    {BACKDROP_PACK_INFO[p].label}
                    {p === packDefault && <span className="ml-1.5 text-2xs font-medium text-muted-foreground">Default</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">{BACKDROP_PACK_INFO[p].text}</span>
                </span>
              </Tile>
            ))}
          </div>
        </div>
        {pack === 'simple' ? (
          <p className="text-xs text-muted-foreground">Simple keeps every page plain, with nothing moving. Pick another style to choose how lively it is.</p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">How lively</p>
            <div role="radiogroup" aria-label="How lively" className="grid grid-cols-3 gap-3">
              {(Object.keys(BACKDROP_LEVEL_INFO) as BackdropLevel[]).map((l) => (
                <Tile key={l} label={BACKDROP_LEVEL_INFO[l].label} selected={level === l} disabled={pending} onClick={() => level !== l && save({ backdropLevel: l === levelDefault ? null : l }, `Backgrounds: ${BACKDROP_LEVEL_INFO[l].label.toLowerCase()}`)}>
                  <span className="px-0.5">
                    <span className="block font-semibold">
                      {BACKDROP_LEVEL_INFO[l].label}
                      {l === levelDefault && <span className="ml-1.5 text-2xs font-medium text-muted-foreground">Default</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">{BACKDROP_LEVEL_INFO[l].text}</span>
                  </span>
                </Tile>
              ))}
            </div>
            {prefs.data.reduceMotion && level === 'lively' && <p className="mt-2 text-xs text-muted-foreground">“Reduce motion” is on, so backgrounds stay still.</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

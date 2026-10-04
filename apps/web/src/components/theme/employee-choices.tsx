'use client';

import React from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import type { CompanyPersonalization, MenuStyle } from '@hrms/types';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { Field, inputClass } from '@/components/ui/field';
import { MENU_STYLE_INFO } from '@/components/preferences/personal-look';
import { useCompanyTheme, usePreferences, useUpdatePersonalization } from '@/lib/company/queries';
import { useUpdateUiDefaults } from '@/lib/preferences/ui-state';
import { Button } from '@/components/ui/button';
import { THEME_PRESETS } from '@/lib/theme/presets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        checked ? 'bg-primary' : 'bg-input',
      )}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-card transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  );
}

/**
 * Settings → Theme: what employees may change for themselves.
 * Each change saves straight away (it's separate from publishing the company theme).
 */
export function EmployeeChoicesCard({ companyId }: { companyId: string }) {
  const theme = useCompanyTheme(companyId);
  const update = useUpdatePersonalization(companyId);
  const rules = theme.data?.personalization;

  const change = async (body: Partial<CompanyPersonalization>, done = 'Saved') => {
    try {
      await update.mutateAsync(body);
      toast.success(done);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  if (!rules) return <Skeleton className="h-64 rounded-xl" />;

  const allowAll = rules.allowedThemes.length === 0;
  const isOffered = (key: string) => allowAll || rules.allowedThemes.includes(key);
  const toggleTheme = (key: string) => {
    const current = allowAll ? THEME_PRESETS.map((p) => p.key) : rules.allowedThemes;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    if (!next.length) {
      toast.error('Keep at least one theme, or turn personal themes off');
      return;
    }
    // Every theme ticked = "all" (also covers themes added later)
    void change({ allowedThemes: next.length === THEME_PRESETS.length ? [] : next });
  };

  return (
    <Card>
      <CardHeader title="What employees can change" description="Personal choices only affect the person who makes them. Saved straight away." />
      <div className="divide-y divide-border border-t border-border">
        <div className="flex items-start gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Personal colour themes</p>
            <p className="text-xs text-muted-foreground">Employees can pick one of the built-in themes in their Preferences. Off = everyone sees the company theme.</p>
          </div>
          <Switch
            label="Personal colour themes"
            checked={rules.personalThemes}
            disabled={update.isPending}
            onChange={(v) => change({ personalThemes: v }, v ? 'Employees can choose their own theme' : 'Everyone sees the company theme')}
          />
        </div>

        {rules.personalThemes && (
          <div className="px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="flex-1 text-sm font-semibold">Themes on offer</p>
              <span className="text-xs text-muted-foreground">{allowAll ? `All ${THEME_PRESETS.length}` : `${rules.allowedThemes.length} of ${THEME_PRESETS.length}`}</span>
              {!allowAll && (
                <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => change({ allowedThemes: [] }, 'All themes on offer')} disabled={update.isPending}>
                  Offer all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {THEME_PRESETS.map((p) => {
                const on = isOffered(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={update.isPending}
                    onClick={() => toggleTheme(p.key)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-60',
                      on ? 'border-primary/40 bg-primary-soft/30' : 'border-border text-muted-foreground hover:border-foreground/20',
                    )}
                  >
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-border" style={{ background: p.tokens.light.primary }} aria-hidden />
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-start gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Personal menu style</p>
            <p className="text-xs text-muted-foreground">Employees can switch the side menu between Classic, Rail, Floating and Collapsible.</p>
          </div>
          <Switch
            label="Personal menu style"
            checked={rules.personalMenuStyle}
            disabled={update.isPending}
            onChange={(v) => change({ personalMenuStyle: v }, v ? 'Employees can choose their menu style' : 'Everyone uses the default menu style')}
          />
        </div>

        <DefaultViews companyId={companyId} />

        <div className="px-5 py-4">
          <Field label="Default menu style" htmlFor="default-menu-style" hint="What everyone sees unless they pick their own.">
            <select
              id="default-menu-style"
              className={cn(inputClass, 'sm:max-w-xs')}
              value={rules.defaultMenuStyle}
              disabled={update.isPending}
              onChange={(e) => change({ defaultMenuStyle: e.target.value as MenuStyle }, 'Default menu style saved')}
            >
              {(Object.keys(MENU_STYLE_INFO) as MenuStyle[]).map((s) => (
                <option key={s} value={s}>
                  {MENU_STYLE_INFO[s].label} — {MENU_STYLE_INFO[s].text}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Card>
  );
}

/** Company default views: copy the admin's own chart choices to everyone who hasn't picked their own. */
function DefaultViews({ companyId }: { companyId: string }) {
  const theme = useCompanyTheme(companyId);
  const prefs = usePreferences();
  const update = useUpdateUiDefaults(companyId);
  const mine = Object.fromEntries(Object.entries(prefs.data?.uiState ?? {}).filter(([k]) => k.startsWith('chart:')));
  const current = Object.keys(theme.data?.uiDefaults ?? {}).length;
  const save = async (values: Record<string, unknown>, done: string) => {
    try {
      await update.mutateAsync(values);
      toast.success(done);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };
  return (
    <div className="flex flex-wrap items-start gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Default chart views</p>
        <p className="text-xs text-muted-foreground">
          What everyone sees until they pick their own. {current ? `${current} default${current === 1 ? '' : 's'} set.` : 'None set — built-in defaults are used.'} Set your own chart styles on the home page, then copy them here.
        </p>
      </div>
      <div className="flex gap-2">
        {current > 0 && <Button size="sm" variant="ghost" disabled={update.isPending} onClick={() => save({}, 'Company defaults cleared')}>Clear</Button>}
        <Button size="sm" variant="secondary" loading={update.isPending} disabled={!Object.keys(mine).length} onClick={() => save(mine, 'Your chart views are now the company default')}>
          Use my chart views ({Object.keys(mine).length})
        </Button>
      </div>
    </div>
  );
}

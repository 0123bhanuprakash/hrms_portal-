'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Check, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { Field, inputClass } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { DisplaySettingsCard } from '@/components/preferences/display-preferences';
import { ColourThemeCard, MenuStyleCard, MomentsCard, SavedViewsCard } from '@/components/preferences/personal-look';
import { NotificationSettingsCard } from '@/components/notifications/notification-settings-card';
import { usePreferences, useUpdatePreferences, type UserPreferences } from '@/lib/company/queries';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', example: '31/12/2026' },
  { value: 'MM/DD/YYYY', example: '12/31/2026' },
  { value: 'YYYY-MM-DD', example: '2026-12-31' },
];

const APPEARANCE: Array<{ value: UserPreferences['theme']; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
];

export default function PreferencesPage() {
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const { setTheme, resolvedTheme } = useTheme();
  const [form, setForm] = useState<Pick<UserPreferences, 'theme' | 'timezone' | 'dateFormat'>>({
    theme: 'light',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
  });

  useEffect(() => {
    if (prefs.data) {
      setForm({
        // Only light and dark are offered; an old “system” choice shows as what the device uses now
        theme: prefs.data.theme === 'dark' || prefs.data.theme === 'light' ? prefs.data.theme : resolvedTheme === 'dark' ? 'dark' : 'light',
        timezone: prefs.data.timezone || 'Asia/Kolkata',
        dateFormat: prefs.data.dateFormat || 'DD/MM/YYYY',
      });
    }
  }, [prefs.data, resolvedTheme]);

  const dirty =
    prefs.data &&
    (form.theme !== prefs.data.theme || form.timezone !== prefs.data.timezone || form.dateFormat !== prefs.data.dateFormat);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync(form);
      setTheme(form.theme);
      toast.success('Preferences saved');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save preferences'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Preferences" description="Personal settings — they only affect you." />

      <form onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader title="Appearance" description="Choose light or dark. You can also flip it from the switch in the top bar." />
          <div role="radiogroup" className="grid grid-cols-2 gap-3 px-5 pb-5">
            {APPEARANCE.map((a) => {
              const selected = form.theme === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setForm((f) => ({ ...f, theme: a.value }));
                    setTheme(a.value);
                  }}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5',
                    selected ? 'border-primary bg-primary-soft/50 text-foreground ring-1 ring-primary/30' : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                  )}
                >
                  {selected && <Check className="absolute right-2 top-2 !size-3.5 text-primary" />}
                  {a.icon}
                  {a.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Regional" description="Used for dates and times you see in the portal." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Time zone" htmlFor="tz">
              {prefs.isLoading ? (
                <Skeleton className="h-9" />
              ) : (
                <select id="tz" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} className={inputClass}>
                  {[...new Set([form.timezone, ...TIMEZONES])].map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Date format" htmlFor="df">
              {prefs.isLoading ? (
                <Skeleton className="h-9" />
              ) : (
                <select id="df" value={form.dateFormat} onChange={(e) => setForm((f) => ({ ...f, dateFormat: e.target.value }))} className={inputClass}>
                  {DATE_FORMATS.map((d) => (
                    <option key={d.value} value={d.value}>{d.value} — {d.example}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!dirty}>
            Save preferences
          </Button>
        </div>
      </form>

      <ColourThemeCard />
      <MenuStyleCard />
      <MomentsCard />
      <SavedViewsCard />
      <DisplaySettingsCard />
      <NotificationSettingsCard />
    </div>
  );
}

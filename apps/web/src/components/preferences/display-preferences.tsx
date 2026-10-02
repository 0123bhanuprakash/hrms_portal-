'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, Rows2, Rows3, Rows4, Sparkles, Type } from 'lucide-react';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { Segmented } from '@/components/theme/theme-editor';
import { usePreferences, useUpdatePreferences } from '@/lib/company/queries';
import { getApiErrorMessage } from '@/lib/errors';
import {
  applyDisplay,
  cacheDisplay,
  cachedDisplay,
  toDisplayPrefs,
  type DensityPref,
  type DisplayPrefs,
  type TextSizePref,
} from '@/lib/preferences/display';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/cn';

/**
 * Applies the signed-in user's display settings to the whole document
 * while a portal is open; removed again on sign-out / leaving the portal.
 */
export function DisplayPreferences() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const prefs = usePreferences();

  useEffect(() => {
    if (!userId) return;
    const cached = cachedDisplay(userId);
    if (cached) applyDisplay(cached);
    return () => applyDisplay(null);
  }, [userId]);

  useEffect(() => {
    if (!userId || !prefs.data) return;
    const display = toDisplayPrefs(prefs.data);
    applyDisplay(display);
    cacheDisplay(userId, display);
  }, [userId, prefs.data]);

  return null;
}

const DENSITY: Array<{ value: DensityPref; label: string; icon?: React.ReactNode }> = [
  { value: 'theme', label: 'Theme' },
  { value: 'compact', label: 'Compact', icon: <Rows4 /> },
  { value: 'normal', label: 'Normal', icon: <Rows3 /> },
  { value: 'spacious', label: 'Spacious', icon: <Rows2 /> },
];

const TEXT: Array<{ value: TextSizePref; label: string; aria?: string }> = [
  { value: 'theme', label: 'Theme' },
  { value: 'sm', label: 'A', aria: 'Small text' },
  { value: 'md', label: 'A', aria: 'Default text' },
  { value: 'lg', label: 'A', aria: 'Large text' },
  { value: 'xl', label: 'A', aria: 'Extra large text' },
];
const TEXT_LABEL: Record<TextSizePref, string> = { theme: 'Theme default', sm: 'Small', md: 'Default', lg: 'Large', xl: 'Extra large' };

/** Density, text size and motion. Changes apply instantly and save automatically. */
export function DisplaySettingsCard() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const [value, setValue] = useState<DisplayPrefs | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (prefs.data) setValue(toDisplayPrefs(prefs.data));
  }, [prefs.data]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const change = async (patch: Partial<DisplayPrefs>) => {
    if (!value) return;
    const previous = value;
    const next = { ...value, ...patch };
    setValue(next);
    applyDisplay(next);
    try {
      await update.mutateAsync(patch);
      if (userId) cacheDisplay(userId, next);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setValue(previous);
      applyDisplay(previous);
      toast.error(getApiErrorMessage(err, 'Could not save display settings'));
    }
  };

  const status = update.isPending ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Saving
    </span>
  ) : saved ? (
    <span className="inline-flex items-center gap-1 text-xs text-success animate-in fade-in-0">
      <Check className="h-3 w-3" /> Saved
    </span>
  ) : null;

  return (
    <Card>
      <CardHeader
        title="Display"
        description="Make the interface fit how you work. Changes apply right away and only affect you."
        action={status}
      />
      {!value ? (
        <div className="space-y-4 px-5 pb-5">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          <Row icon={<Rows3 />} title="Density" hint="How much space sits between items. Theme uses your company's setting.">
            <Segmented value={value.density} onChange={(density) => change({ density })} options={DENSITY} />
          </Row>

          <Row icon={<Type />} title="Text size" hint={TEXT_LABEL[value.textSize]}>
            <div role="radiogroup" className="flex w-full rounded-md border border-border bg-muted p-0.5">
              {TEXT.map((o, i) => {
                const selected = o.value === value.textSize;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={o.aria ?? o.label}
                    onClick={() => change({ textSize: o.value })}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center rounded-[calc(var(--radius)-4px)] font-medium transition-all',
                      selected ? 'bg-surface text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
                    )}
                    // Fixed px sizes so the buttons preview each size regardless of the current one
                    style={i === 0 ? { fontSize: 13 } : { fontSize: [12, 14, 16, 18][i - 1] }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </Row>

          <Row icon={<Sparkles />} title="Reduce motion" hint="Turns off animations and transitions. Always on when your device asks for reduced motion.">
            <button
              type="button"
              role="switch"
              aria-checked={value.reduceMotion}
              aria-label="Reduce motion"
              onClick={() => change({ reduceMotion: !value.reduceMotion })}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                value.reduceMotion ? 'bg-primary' : 'bg-input',
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 rounded-full bg-white shadow-card transition-transform',
                  value.reduceMotion ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </Row>
        </div>
      )}
    </Card>
  );
}

function Row({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] sm:items-center">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="flex sm:justify-end">{children}</div>
    </div>
  );
}

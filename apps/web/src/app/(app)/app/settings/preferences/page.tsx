'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Bell, Check, Eye, Globe, Keyboard, LayoutDashboard, Mail, Moon, MoonStar, Palette, RotateCcw, Search, Sparkles, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { SearchSelect } from '@/components/ui/pickers';
import { PageHeader } from '@/components/ui/page-header';
import { DisplaySettingsCard } from '@/components/preferences/display-preferences';
import { BackdropCard, ColourThemeCard, MenuStyleCard, MomentsCard, SavedViewsCard } from '@/components/preferences/personal-look';
import { HOME_CARDS, useHomeHiddenState } from '@/components/preferences/home-cards';
import { useA11yPrefs } from '@/components/preferences/a11y-prefs';
import { useSeasonLook } from '@/components/season/season';
import { usePreferences, useUpdatePreferences, type UserPreferences } from '@/lib/company/queries';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type SectionId = 'look' | 'region' | 'notifications' | 'home' | 'accessibility' | 'shortcuts';
const SECTIONS: Array<{ id: SectionId; label: string; icon: React.ReactNode; words: string }> = [
  { id: 'look', label: 'Look', icon: <Palette />, words: 'light dark colour theme menu background moments density text size season festive decorations' },
  { id: 'region', label: 'Region', icon: <Globe />, words: 'time zone date format week start clock city' },
  { id: 'notifications', label: 'Notifications', icon: <Bell />, words: 'email notifications quiet hours summary leave expenses helpdesk kudos assets announcements' },
  { id: 'home', label: 'Home & views', icon: <LayoutDashboard />, words: 'home cards who’s off celebrations kudos announcements saved views' },
  { id: 'accessibility', label: 'Accessibility', icon: <Eye />, words: 'motion contrast focus outline underline links' },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard />, words: 'keyboard shortcuts keys' },
];

const TOPICS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'time', label: 'Leave & attendance', hint: 'Requests to approve, decisions, reminders, cover' },
  { key: 'work', label: 'Timesheets & projects', hint: 'Timesheets to approve, project updates' },
  { key: 'expenses', label: 'Expenses', hint: 'Claims to approve, approved, paid' },
  { key: 'helpdesk', label: 'Helpdesk', hint: 'Replies on my tickets, assigned to me' },
  { key: 'announcements', label: 'Announcements', hint: 'New posts, things to confirm' },
  { key: 'kudos', label: 'Kudos & celebrations', hint: 'Kudos to me and my team' },
  { key: 'assets', label: 'Assets', hint: 'Hand-overs to confirm, due back' },
];

/** Saves one change straight away and flashes "Saved". */
function useSaver() {
  const update = useUpdatePreferences();
  const [savedAt, setSavedAt] = useState(0);
  const save = async (patch: Partial<UserPreferences>, done?: string) => {
    try {
      await update.mutateAsync(patch);
      setSavedAt(Date.now());
      if (done) toast.success(done);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };
  return { save, saving: update.isPending, savedAt };
}

export default function PreferencesPage() {
  const prefs = usePreferences();
  const saver = useSaver();
  const [q, setQ] = useState('');
  const [active, setActive] = useState<SectionId>('look');
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!saver.savedAt) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [saver.savedAt]);

  const shown = SECTIONS.filter((s) => !q.trim() || `${s.label} ${s.words}`.toLowerCase().includes(q.trim().toLowerCase()));
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(`pref-${s.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id.replace('pref-', '') as SectionId);
    }, { rootMargin: '-80px 0px -60% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [shown.length, Boolean(prefs.data)]);
  // Links like /app/settings/preferences#pref-notifications open on that section once loaded
  useEffect(() => {
    if (!prefs.data || !window.location.hash) return;
    const t = setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 200);
    return () => clearTimeout(t);
  }, [Boolean(prefs.data)]); // eslint-disable-line react-hooks/exhaustive-deps

  const has = (id: SectionId) => shown.some((s) => s.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Preferences"
        description="Only for you. Changes save as you go."
        action={
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity', flash ? 'bg-success-soft text-success opacity-100 m-pop' : 'opacity-0')} aria-live="polite">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-2">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings" className="pl-8" aria-label="Search settings" />
            </div>
            <div className="flex gap-1 overflow-x-auto lg:flex-col">
              {shown.map((s) => (
                <a
                  key={s.id}
                  href={`#pref-${s.id}`}
                  className={cn('flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors [&_svg]:size-4', active === s.id ? 'bg-primary-soft font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                >
                  {s.icon}
                  {s.label}
                </a>
              ))}
              {!shown.length && <p className="px-2 py-3 text-xs text-muted-foreground">Nothing matches “{q}”.</p>}
            </div>
          </Card>
        </nav>

        <div className="min-w-0 space-y-8">
          {prefs.isLoadingError ? (
            <ErrorState message={getApiErrorMessage(prefs.error, 'Could not load your preferences')} onRetry={() => void prefs.refetch()} />
          ) : !prefs.data ? (
            <Skeleton className="h-96" />
          ) : (
            <>
              {has('look') && (
                <Section id="look" title="Look" icon={<Palette />}>
                  <Appearance prefs={prefs.data} save={saver.save} />
                  <SeasonChoice />
                  <ColourThemeCard />
                  <MenuStyleCard />
                  <BackdropCard />
                  <MomentsCard />
                  <DisplaySettingsCard />
                </Section>
              )}
              {has('region') && (
                <Section id="region" title="Region" icon={<Globe />}>
                  <Region prefs={prefs.data} save={saver.save} />
                </Section>
              )}
              {has('notifications') && (
                <Section id="notifications" title="Notifications" icon={<Bell />}>
                  <Notifications prefs={prefs.data} save={saver.save} />
                </Section>
              )}
              {has('home') && (
                <Section id="home" title="Home & views" icon={<LayoutDashboard />}>
                  <HomeCardsCard />
                  <SavedViewsCard />
                </Section>
              )}
              {has('accessibility') && (
                <Section id="accessibility" title="Accessibility" icon={<Eye />}>
                  <Accessibility prefs={prefs.data} save={saver.save} />
                </Section>
              )}
              {has('shortcuts') && (
                <Section id="shortcuts" title="Shortcuts" icon={<Keyboard />}>
                  <Shortcuts />
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, icon, children }: { id: SectionId; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={`pref-${id}`} className="scroll-mt-20 space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight [&_svg]:size-5 [&_svg]:text-primary">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-primary' : 'bg-muted-foreground/30')}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

function Row({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

type Save = (patch: Partial<UserPreferences>, done?: string) => Promise<void>;

// ─── Look ───────────────────────────────────────────────────

function Appearance({ prefs, save }: { prefs: UserPreferences; save: Save }) {
  const { setTheme, resolvedTheme } = useTheme();
  const current = prefs.theme === 'dark' || prefs.theme === 'light' ? prefs.theme : resolvedTheme === 'dark' ? 'dark' : 'light';
  return (
    <Card>
      <CardHeader title="Light or dark" description="You can also flip it from the switch in the top bar." />
      <div role="radiogroup" className="grid grid-cols-2 gap-3 px-5 pb-5">
        {([['light', 'Light', <Sun key="s" />, 'bg-white'], ['dark', 'Dark', <Moon key="m" />, 'bg-[#17151F]']] as const).map(([v, l, ic, swatch]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={current === v}
            onClick={() => {
              setTheme(v);
              void save({ theme: v });
            }}
            className={cn('relative flex flex-col gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-all', current === v ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-foreground/20')}
          >
            <span className={cn('flex h-14 items-end gap-1.5 rounded-lg border border-border p-2', swatch)}>
              <span className="h-2 w-8 rounded bg-primary" />
              <span className={cn('h-2 w-12 rounded', v === 'dark' ? 'bg-white/20' : 'bg-black/10')} />
            </span>
            <span className="flex items-center gap-1.5 [&_svg]:size-4">{ic} {l}</span>
            {current === v && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
          </button>
        ))}
      </div>
    </Card>
  );
}

const isChoice = (v: unknown): v is 'season' | 'mine' => v === 'season' || v === 'mine';

function SeasonChoice() {
  const [always, setAlways] = useUiState<'season' | 'mine'>('season.default', 'season', isChoice);
  const { decorations, setDecorations } = useA11yPrefs();
  const { season, pick, setPick } = useSeasonLook();
  return (
    <Card>
      <CardHeader title="Company seasons" description="Festival looks (Diwali, New Year…) your company switches on for a few days." icon={<Sparkles />} />
      <div className="divide-y divide-border border-t border-border">
        <Row title="During company seasons" hint={always === 'season' ? 'You see the festival colours.' : 'You keep your own theme — you still see the greeting.'}>
          <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs" role="radiogroup">
            {([['season', 'Use the season'], ['mine', 'Keep my theme']] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={always === v} onClick={() => { setAlways(v); if (season) setPick(''); }} className={cn('rounded-md px-2.5 py-1', always === v ? 'bg-surface font-semibold shadow-sm' : 'text-muted-foreground')}>
                {l}
              </button>
            ))}
          </div>
        </Row>
        <Row title="Festive decorations" hint="Diyas, snow, confetti — gentle and only on Home.">
          <Toggle on={decorations} onChange={setDecorations} label="Festive decorations" />
        </Row>
        {season && (
          <Row title={`${season.emoji} ${season.name} is on now`} hint={pick === 'mine' ? 'You switched back to your theme for this one.' : 'You’re seeing it.'}>
            <Button size="sm" variant="secondary" onClick={() => setPick(pick === 'mine' ? 'keep' : 'mine')}>{pick === 'mine' ? 'Show the season' : 'Switch back to my theme'}</Button>
          </Row>
        )}
      </div>
    </Card>
  );
}

// ─── Region ─────────────────────────────────────────────────

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', example: '31/12/2026' },
  { value: 'MM/DD/YYYY', example: '12/31/2026' },
  { value: 'YYYY-MM-DD', example: '2026-12-31' },
];
const isWeek = (v: unknown): v is 'mon' | 'sun' => v === 'mon' || v === 'sun';

function Region({ prefs, save }: { prefs: UserPreferences; save: Save }) {
  const [week, setWeek] = useUiState<'mon' | 'sun'>('week.start', 'mon', isWeek);
  const zones = useMemo(() => {
    let list: string[] = [];
    try {
      list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    } catch {
      /* old browser */
    }
    if (!list.length) list = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
    const tz = prefs.timezone || 'Asia/Kolkata';
    return [...new Set([tz, ...list])].map((z) => {
      const city = z.split('/').pop()!.replace(/_/g, ' ');
      return { value: z, label: city, sub: `${z.split('/')[0]} · ${clock(z)}`, keywords: z };
    });
  }, [prefs.timezone]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const tz = prefs.timezone || 'Asia/Kolkata';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const h = +(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = +(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return (
    <Card>
      <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
        <svg width="84" height="84" viewBox="0 0 84 84" aria-label={`${clock(tz)} in ${tz}`}>
          <circle cx="42" cy="42" r="38" fill="hsl(var(--surface))" stroke="hsl(var(--border))" strokeWidth="2" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <circle key={i} cx={42 + Math.sin(a) * 31} cy={42 - Math.cos(a) * 31} r="1.6" fill="hsl(var(--muted-foreground))" />;
          })}
          <line x1="42" y1="42" x2="42" y2="22" stroke="hsl(var(--foreground))" strokeWidth="3.5" strokeLinecap="round" style={{ transform: `rotate(${(h % 12) * 30 + m * 0.5}deg)`, transformOrigin: '42px 42px', transition: 'transform 0.9s cubic-bezier(0.2,0.8,0.2,1)' }} />
          <line x1="42" y1="42" x2="42" y2="14" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" style={{ transform: `rotate(${m * 6}deg)`, transformOrigin: '42px 42px', transition: 'transform 0.9s cubic-bezier(0.2,0.8,0.2,1)' }} />
          <circle cx="42" cy="42" r="3" fill="hsl(var(--primary))" />
        </svg>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Time zone</p>
            <SearchSelect aria-label="Time zone" value={tz} onChange={(v) => void save({ timezone: v })} options={zones} searchPlaceholder="Search a city…" searchable />
            <p className="text-xs text-muted-foreground">Dates and times you see use this.</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Date format</p>
            <div className="flex flex-wrap gap-1.5">
              {DATE_FORMATS.map((d) => (
                <button key={d.value} type="button" aria-pressed={prefs.dateFormat === d.value} onClick={() => void save({ dateFormat: d.value })} className={cn('rounded-lg border px-2.5 py-1 text-xs', prefs.dateFormat === d.value ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                  {d.example}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Week starts on</p>
            <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs">
              {([['mon', 'Monday'], ['sun', 'Sunday']] as const).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={week === v} onClick={() => setWeek(v)} className={cn('rounded-md px-2.5 py-1', week === v ? 'bg-surface font-semibold shadow-sm' : 'text-muted-foreground')}>{l}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Used in the date pickers.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

const clock = (tz: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date());
  } catch {
    return '';
  }
};

// ─── Notifications ──────────────────────────────────────────

function Notifications({ prefs, save }: { prefs: UserPreferences; save: Save }) {
  const topics = prefs.notificationTopics ?? {};
  const emailsOn = prefs.emailNotifications ?? true;
  const quiet = prefs.quietHours ?? { on: false, from: '20:00', to: '08:00', weekends: true };
  const set = (key: string, kind: 'app' | 'email', v: boolean) => void save({ notificationTopics: { [key]: { [kind]: v } } as UserPreferences['notificationTopics'] });
  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader title="What to tell me about" description="Off in the app = it still lands in the bell, quietly (no badge). Off for both = nothing." icon={<Bell />} />
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Topic</th>
                <th className="w-28 px-3 py-2 font-semibold">In the app</th>
                <th className="w-28 px-3 py-2 font-semibold">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {TOPICS.map((t) => (
                <tr key={t.key}>
                  <td className="px-5 py-2.5">
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.hint}</p>
                  </td>
                  <td className="px-3 text-center"><span className="inline-flex"><Toggle on={topics[t.key]?.app !== false} onChange={(v) => set(t.key, 'app', v)} label={`${t.label} in the app`} /></span></td>
                  <td className="px-3 text-center"><span className="inline-flex"><Toggle on={emailsOn && topics[t.key]?.email !== false} disabled={!emailsOn} onChange={(v) => set(t.key, 'email', v)} label={`${t.label} by email`} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-border border-t border-border">
          <Row title="Emails at all" hint="Turn off to get nothing by email (the bell keeps everything).">
            <Toggle on={emailsOn} onChange={(v) => void save({ emailNotifications: v }, v ? 'Emails on' : 'No more emails — the bell keeps everything')} label="Emails" />
          </Row>
        </div>
      </Card>
      <Card>
        <CardHeader title="Quiet hours" description="No emails at these times — they wait and come together after." icon={<MoonStar />} />
        <div className="divide-y divide-border border-t border-border">
          <Row title="Quiet hours" hint={quiet.on ? `${quiet.from} – ${quiet.to}${quiet.weekends ? ' and all weekend' : ''}` : 'Off'}>
            <Toggle on={quiet.on} onChange={(v) => void save({ quietHours: { ...quiet, on: v } })} label="Quiet hours" />
          </Row>
          {quiet.on && (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm m-rise">
              <label className="flex items-center gap-2">From <input type="time" value={quiet.from} onChange={(e) => e.target.value && void save({ quietHours: { ...quiet, from: e.target.value } })} className="h-8 rounded-md border border-input bg-surface px-2" /></label>
              <label className="flex items-center gap-2">to <input type="time" value={quiet.to} onChange={(e) => e.target.value && void save({ quietHours: { ...quiet, to: e.target.value } })} className="h-8 rounded-md border border-input bg-surface px-2" /></label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={quiet.weekends} onChange={(e) => void save({ quietHours: { ...quiet, weekends: e.target.checked } })} /> All weekend</label>
            </div>
          )}
          <Row title="Daily summary instead" hint="One email at 9 am with everything from before — nothing in between.">
            <Toggle on={prefs.dailySummary ?? false} disabled={!emailsOn} onChange={(v) => void save({ dailySummary: v })} label="Daily summary" />
          </Row>
        </div>
      </Card>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Account and security emails always come through.</p>
    </>
  );
}

// ─── Home ───────────────────────────────────────────────────

function HomeCardsCard() {
  const [hidden, setHidden] = useHomeHiddenState();
  return (
    <Card>
      <CardHeader title="Home cards" description="Hide what you don’t need on your Home." icon={<LayoutDashboard />} />
      <div className="divide-y divide-border border-t border-border">
        {HOME_CARDS.map((c) => (
          <Row key={c.id} title={c.label} hint={c.hint}>
            <Toggle on={!hidden.includes(c.id)} onChange={(on) => setHidden(on ? hidden.filter((x) => x !== c.id) : [...hidden, c.id])} label={`Show ${c.label}`} />
          </Row>
        ))}
      </div>
    </Card>
  );
}

// ─── Accessibility ──────────────────────────────────────────

function Accessibility({ prefs, save }: { prefs: UserPreferences; save: Save }) {
  const a = useA11yPrefs();
  return (
    <Card>
      <div className="divide-y divide-border">
        <Row title="Less motion" hint="No moving backgrounds, confetti or decorations.">
          <Toggle on={prefs.reduceMotion ?? false} onChange={(v) => void save({ reduceMotion: v })} label="Less motion" />
        </Row>
        <Row title="Stronger contrast" hint="Darker grey text and borders.">
          <Toggle on={a.contrast} onChange={a.setContrast} label="Stronger contrast" />
        </Row>
        <Row title="Always show the focus outline" hint="A clear ring around whatever the keyboard is on.">
          <Toggle on={a.focus} onChange={a.setFocus} label="Focus outline" />
        </Row>
        <Row title="Underline links" hint="Easier to spot links in text.">
          <Toggle on={a.underline} onChange={a.setUnderline} label="Underline links" />
        </Row>
      </div>
      <div className="flex justify-end border-t border-border px-5 py-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            a.setContrast(false);
            a.setFocus(false);
            a.setUnderline(false);
            void save({ reduceMotion: false }, 'Accessibility back to normal');
          }}
        >
          <RotateCcw /> Reset
        </Button>
      </div>
    </Card>
  );
}

// ─── Shortcuts ──────────────────────────────────────────────

const KEYS: Array<[string[], string]> = [
  [['Ctrl', 'Enter'], 'Save or send in any popup form'],
  [['Esc'], 'Close a popup (asks first if you typed something)'],
  [['↑', '↓', 'Enter'], 'Move through and pick in search lists'],
  [['J', 'K'], 'Next / previous request in attendance approvals'],
  [['A', 'R'], 'Approve / reject in attendance approvals'],
  [['Ctrl', 'Z'], 'Undo in the theme editor (Ctrl + Shift + Z to redo)'],
];

function Shortcuts() {
  return (
    <Card>
      <ul className="divide-y divide-border">
        {KEYS.map(([keys, what]) => (
          <li key={what} className="flex items-center gap-4 px-5 py-2.5 text-sm">
            <span className="flex w-40 shrink-0 gap-1">
              {keys.map((k) => (
                <kbd key={k} className="rounded border border-b-2 border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold">{k}</kbd>
              ))}
            </span>
            <span className="text-muted-foreground">{what}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

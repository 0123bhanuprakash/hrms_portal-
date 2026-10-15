'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Eye, MoreHorizontal, Pencil, Plus, Power, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ColorInput, Field, FormError, Input } from '@/components/ui/field';
import { DateInput } from '@/components/ui/pickers';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { SeasonDecor } from '@/components/season/season';
import { useUiState } from '@/lib/preferences/ui-state';
import {
  DECORATIONS,
  seasonFromInput,
  startSeasonPreview,
  useDeleteSeason,
  useSaveSeason,
  useSeasonPresets,
  useSeasons,
  type Season,
  type SeasonInput,
  type SeasonPreset,
} from '@/lib/company/seasons';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (k: string) => new Date(`${k}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const range = (a: string, b: string) => (a === b ? day(a) : `${day(a)} – ${day(b)}`);
const grad = (c: { main: string; accent: string; deep: string }) => `linear-gradient(135deg, ${c.deep}, ${c.main} 55%, ${c.accent})`;
const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Settings → Theme → Seasonal: plan festival looks for the year. */
export function SeasonsTab() {
  const seasons = useSeasons();
  const presets = useSeasonPresets();
  const save = useSaveSeason();
  const remove = useDeleteSeason();
  const [editing, setEditing] = useState<{ input: SeasonInput; id?: string } | null>(null);
  const [deleting, setDeleting] = useState<Season | null>(null);
  const [dismissed, setDismissed] = useUiState<string[]>('season.dismissed', [], isList);

  if (seasons.isLoadingError) return <ErrorState message={getApiErrorMessage(seasons.error, 'Could not load seasons')} onRetry={() => seasons.refetch()} />;
  if (!seasons.data || !presets.data) return <Skeleton className="h-96" />;

  const { today, seasons: list, suggestions } = seasons.data;
  const fromPreset = (p: SeasonPreset): SeasonInput => ({
    preset: p.key,
    name: p.name,
    emoji: p.emoji,
    startsOn: p.startsOn ?? today,
    endsOn: p.endsOn ?? today,
    everyYear: true,
    colors: p.colors,
    decoration: p.decoration,
    greeting: p.greeting,
    onSignIn: true,
  });
  const asInput = (s: Season): SeasonInput => ({ ...s, preset: s.preset ?? undefined, greeting: s.greeting ?? undefined });
  const blank: SeasonInput = { name: '', emoji: '🎉', startsOn: today, endsOn: today, everyYear: true, colors: { main: '#E9416A', accent: '#7A2BD9', deep: '#1B1530' }, decoration: 'confetti', greeting: '', onSignIn: true };

  const toggle = async (s: Season) => {
    try {
      await save.mutateAsync({ id: s.id, enabled: !s.enabled });
      toast.success(s.enabled ? `“${s.name}” switched off` : `“${s.name}” is on`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not change the season'));
    }
  };
  const quickAdd = async (input: SeasonInput) => {
    try {
      await save.mutateAsync(input);
      toast.success(`${input.emoji} ${input.name} planned for ${range(input.startsOn, input.endsOn)}`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not add the season'));
    }
  };

  const shownSuggestions = suggestions.filter((s) => !dismissed.includes(`${s.preset}:${s.startsOn}`));

  return (
    <div className="space-y-5">
      <YearStrip today={today} seasons={list} />

      {shownSuggestions.map((s) => (
        <div key={s.preset} className="m-rise flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft/50 px-4 py-3 text-sm">
          <span className="text-2xl" aria-hidden>{s.emoji}</span>
          <span className="min-w-0 flex-1">
            <b>{s.holiday} is on your holiday list.</b> Turn on “{s.name}” for {range(s.startsOn, s.endsOn)}?
          </span>
          <Button size="sm" variant="ghost" onClick={() => setDismissed([...dismissed, `${s.preset}:${s.startsOn}`])}>Not this year</Button>
          <Button size="sm" loading={save.isPending} onClick={() => void quickAdd(fromPreset(presets.data.find((p) => p.key === s.preset)!))}>
            Turn on
          </Button>
        </div>
      ))}

      {list.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center border-b border-border px-4 py-3">
            <p className="flex-1 text-sm font-semibold">Your seasons</p>
            <Button size="sm" onClick={() => setEditing({ input: blank })}><Plus /> Your own</Button>
          </div>
          <ul className="divide-y divide-border m-stagger">
            {list.map((s) => (
              <li key={s.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !s.enabled && 'opacity-60')}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: grad(s.colors) }} aria-hidden>{s.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {range(s.startsOn, s.endsOn)}
                    {s.everyYear && ' · every year'}
                    {!s.onSignIn && ' · not on the sign-in page'}
                  </p>
                </div>
                {s.status === 'live' ? (
                  <Badge tone="success" dot>On now · {s.daysLeft === 1 ? 'last day' : `${s.daysLeft} days left`}</Badge>
                ) : s.status === 'off' ? (
                  <Badge tone="neutral">Off</Badge>
                ) : (
                  <Badge tone="info">in {s.startsInDays} day{s.startsInDays === 1 ? '' : 's'}</Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => startSeasonPreview(s)}><Eye /> Try</Button>
                <DropdownMenu
                  label={s.name}
                  items={[
                    { label: 'Edit', icon: <Pencil />, onSelect: () => setEditing({ input: asInput(s), id: s.id }) },
                    { label: s.enabled ? 'Switch off' : 'Switch on', icon: <Power />, onSelect: () => void toggle(s) },
                    'separator',
                    { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => setDeleting(s) },
                  ]}
                  trigger={() => (
                    <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${s.name}`}>
                      <MoreHorizontal />
                    </Button>
                  )}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <p className="flex-1 text-sm font-semibold">Ready-made national festivals</p>
          {list.length === 0 && <Button size="sm" variant="secondary" onClick={() => setEditing({ input: blank })}><Plus /> Your own</Button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 m-stagger">
          {presets.data.map((p) => {
            const planned = list.find((s) => s.preset === p.key);
            return (
              <Card key={p.key} className={cn('flex flex-col overflow-hidden', planned && 'ring-2 ring-primary')}>
                <div className="relative h-24 overflow-hidden" style={{ background: grad(p.colors) }}>
                  <SeasonDecor kind={p.decoration} colors={p.colors} />
                  <span className="absolute bottom-2 left-3 text-3xl drop-shadow" aria-hidden>{p.emoji}</span>
                  {planned && <Badge tone="success" className="absolute right-2 top-2">{planned.status === 'live' ? 'On now' : planned.enabled ? 'Planned' : 'Off'}</Badge>}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{p.startsOn ? range(p.startsOn, p.endsOn!) : '—'}</span>
                  </div>
                  <div className="flex gap-1">
                    {[p.colors.main, p.colors.accent, p.colors.deep].map((c) => (
                      <span key={c} className="h-4 w-4 rounded-full border border-black/10" style={{ background: c }} />
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">{DECORATIONS.find((d) => d.value === p.decoration)?.label}</span>
                  </div>
                  <div className="mt-auto flex gap-2 pt-1">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => startSeasonPreview(seasonFromInput(fromPreset(p)))}>
                      <Eye /> Try
                    </Button>
                    {planned ? (
                      <Button size="sm" variant="secondary" onClick={() => setEditing({ input: asInput(planned), id: planned.id })}>Edit</Button>
                    ) : (
                      <Button size="sm" disabled={!p.startsOn} onClick={() => setEditing({ input: fromPreset(p) })}>Use</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {editing && <SeasonEditor key={editing.id ?? editing.input.preset ?? 'new'} initial={editing.input} id={editing.id} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        isDanger
        isLoading={remove.isPending}
        title={`Delete “${deleting?.name}”?`}
        description="It won’t switch on again. You can add it back from the ready-made list."
        confirmText="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success(`“${deleting.name}” deleted`);
            setDeleting(null);
          } catch (e) {
            toast.error(getApiErrorMessage(e, 'Could not delete'));
          }
        }}
      />
    </div>
  );
}

/** The next 12 months with planned seasons on them; today is the red line. */
function YearStrip({ today, seasons }: { today: string; seasons: Season[] }) {
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00Z`).getTime();
  const end = new Date(Date.UTC(+today.slice(0, 4) + 1, +today.slice(5, 7) - 1, 1)).getTime();
  const pos = (k: string) => ((Date.parse(`${k}T00:00:00Z`) - start) / (end - start)) * 100;
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 + i, 1));
    return { label: MONTHS[d.getUTCMonth()]!, at: ((d.getTime() - start) / (end - start)) * 100 };
  });
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <p className="flex-1 text-sm font-semibold">Your year</p>
        <p className="text-xs text-muted-foreground">Each season switches on at midnight and back to your normal theme by itself.</p>
      </div>
      <div className="relative h-16 overflow-hidden rounded-xl border border-border bg-muted/40">
        {months.map((m) => (
          <span key={m.label + m.at} className="absolute inset-y-0 border-l border-dashed border-border px-1 pt-1 text-[10px] text-muted-foreground" style={{ left: `${m.at}%` }}>
            {m.label}
          </span>
        ))}
        {seasons
          .filter((s) => s.enabled && pos(s.endsOn) >= 0 && pos(s.startsOn) <= 100)
          .map((s) => (
            <span
              key={s.id}
              title={`${s.name} · ${range(s.startsOn, s.endsOn)}`}
              className="absolute top-6 flex h-8 min-w-[26px] items-center justify-center rounded-lg text-base shadow-md m-pop"
              style={{ left: `${Math.max(0, pos(s.startsOn))}%`, width: `${Math.max(1.8, pos(s.endsOn) - pos(s.startsOn) + 0.3)}%`, background: grad(s.colors) }}
            >
              {s.emoji}
            </span>
          ))}
        <span className="absolute inset-y-0 w-0.5 bg-destructive" style={{ left: `${pos(today)}%` }} aria-label="Today" />
      </div>
    </Card>
  );
}

// ─── Make / edit a season ───────────────────────────────────

function SeasonEditor({ initial, id, onClose }: { initial: SeasonInput; id?: string; onClose: () => void }) {
  const save = useSaveSeason();
  const [f, setF] = useState<SeasonInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  useEffect(() => setF(initial), [initial]);
  const set = <K extends keyof SeasonInput>(k: K, v: SeasonInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const preview = useMemo(() => seasonFromInput(f), [f]);

  const submit = async () => {
    setError(null);
    if (f.name.trim().length < 2) return setError('Give the season a name');
    if (!f.emoji.trim()) return setError('Pick an emoji');
    if (f.endsOn < f.startsOn) return setError('The last day must be on or after the first day');
    try {
      const r = await save.mutateAsync({ ...f, id, greeting: f.greeting?.trim() || undefined });
      toast.success(r.status === 'live' ? `${r.emoji} ${r.name} is on now for everyone` : `${r.emoji} ${r.name} saved — starts ${day(r.startsOn)}`);
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not save the season'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      size="lg"
      className="sm:max-w-[980px]"
      icon={<Sparkles />}
      title={id ? `Edit ${f.name}` : f.preset ? f.name : 'Your own season'}
      description="A few festive days on top of your normal theme. It switches back by itself."
      footer={
        <>
          <span className="mr-auto hidden text-xs text-muted-foreground sm:block">Starts on its own on {day(f.startsOn)} at midnight</span>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button variant="secondary" onClick={() => { startSeasonPreview(preview); toast.success('Only you see it for 10 minutes'); }}>
            <Eye /> Try it on me (10 min)
          </Button>
          <Button onClick={() => void submit()} loading={save.isPending}>Save season</Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <FormError>{error}</FormError>
          <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
            <Field label="Name" htmlFor="ss-name" required>
              <Input id="ss-name" value={f.name} maxLength={60} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Company birthday" />
            </Field>
            <Field label="Emoji" htmlFor="ss-emoji" required>
              <Input id="ss-emoji" value={f.emoji} maxLength={8} onChange={(e) => set('emoji', e.target.value)} className="text-center text-lg" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First day" htmlFor="ss-from" required>
              <DateInput id="ss-from" value={f.startsOn} onChange={(e) => setF((x) => ({ ...x, startsOn: e.target.value, endsOn: x.endsOn < e.target.value ? e.target.value : x.endsOn }))} required />
            </Field>
            <Field label="Last day" htmlFor="ss-to" required>
              <DateInput id="ss-to" value={f.endsOn} min={f.startsOn} onChange={(e) => set('endsOn', e.target.value)} required />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={f.everyYear ?? true} onChange={(e) => set('everyYear', e.target.checked)} />
            <span>
              Every year
              <span className="block text-xs text-muted-foreground">{f.preset && ['holi', 'eid', 'ganesh_chaturthi', 'navratri', 'diwali'].includes(f.preset) ? 'This festival moves each year — next year’s dates are filled in for you.' : 'Same days next year.'}</span>
            </span>
          </label>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Colours</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['main', 'accent', 'deep'] as const).map((k) => (
                <Field key={k} label={k === 'main' ? 'Main' : k === 'accent' ? 'Accent' : 'Deep'} htmlFor={`ss-${k}`}>
                  <ColorInput id={`ss-${k}`} value={f.colors[k]} onChange={(v) => set('colors', { ...f.colors, [k]: v })} />
                </Field>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Only the main colour changes buttons and links — fonts, corners and your logo stay.</p>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Decoration</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {DECORATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={f.decoration === d.value}
                  onClick={() => set('decoration', d.value)}
                  className={cn('rounded-xl border p-2 text-center transition-colors', f.decoration === d.value ? 'border-primary bg-primary-soft/60 ring-1 ring-primary/30' : 'border-border hover:bg-muted/60')}
                >
                  <span className="block text-xl" aria-hidden>{d.emoji}</span>
                  <span className="block truncate text-[11px] font-medium">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Field label="Greeting on Home" htmlFor="ss-greet" hint="Shown in a banner at the top of everyone’s Home.">
            <Input id="ss-greet" value={f.greeting ?? ''} maxLength={120} onChange={(e) => set('greeting', e.target.value)} placeholder={`Happy ${f.name || 'holidays'}!`} />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span>
              Also on the sign-in page
              <span className="block text-xs text-muted-foreground">Everyone in the company sees it · people can switch back to their own theme</span>
            </span>
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={f.onSignIn ?? true} onChange={(e) => set('onSignIn', e.target.checked)} />
          </label>
        </div>

        {/* Live preview */}
        <aside className="space-y-2 md:sticky md:top-0 md:self-start">
          <div className="flex items-center">
            <p className="flex-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
            <div className="inline-flex rounded-md border border-border bg-muted p-0.5 text-xs">
              {(['Light', 'Dark'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={dark === (m === 'Dark')} onClick={() => setDark(m === 'Dark')} className={cn('rounded px-2 py-0.5', dark === (m === 'Dark') ? 'bg-surface shadow-sm' : 'text-muted-foreground')}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <MiniHome season={preview} dark={dark} />
        </aside>
      </div>
    </Modal>
  );
}

/** A small Home with the season on it (for the editor preview). */
function MiniHome({ season, dark }: { season: Season; dark: boolean }) {
  const c = season.colors;
  const t = dark ? { bg: '#14121C', card: '#1F1C2B', line: '#2C2840', fg: '#EEEAFF', mut: '#9C95C2' } : { bg: '#F8F7FB', card: '#FFFFFF', line: '#ECE9F4', fg: '#1A1433', mut: '#6E6890' };
  return (
    <div className="flex h-[300px] overflow-hidden rounded-xl border" style={{ background: t.bg, borderColor: t.line, color: t.fg }}>
      <div className="flex w-20 flex-col gap-1.5 border-r p-2" style={{ background: t.card, borderColor: t.line }}>
        <span className="h-6 w-6 rounded-md" style={{ background: `linear-gradient(135deg, ${c.main}, ${c.accent})` }} />
        {['Home', 'Leave', 'People', 'Team'].map((l, i) => (
          <span key={l} className="rounded px-1.5 py-0.5 text-[9px]" style={i === 0 ? { background: `${c.main}2a`, color: c.main, fontWeight: 700 } : { color: t.mut }}>
            {l}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
        <div className="relative overflow-hidden rounded-lg px-3 py-2.5 text-white" style={{ background: `radial-gradient(circle at 85% 0%, ${c.accent}66, transparent 55%), linear-gradient(135deg, ${c.deep}, ${c.main})` }}>
          <SeasonDecor kind={season.decoration} colors={c} />
          <span className="relative text-lg">{season.emoji}</span>
          <p className="relative text-[11px] font-bold leading-tight">{season.greeting || `Happy ${season.name || 'holidays'}`}</p>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {['182', '9', '7'].map((v, i) => (
            <div key={v} className="rounded-md border p-1.5" style={{ background: t.card, borderColor: t.line }}>
              <b className="text-sm" style={{ color: i === 0 ? c.main : i === 1 ? c.accent : t.fg }}>{v}</b>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-md border" style={{ background: t.card, borderColor: t.line }} />
        <span className="h-5 w-20 rounded-md" style={{ background: c.main }} />
      </div>
    </div>
  );
}

export function NoSeasonAccess() {
  return <EmptyState icon={<Sparkles />} title="Seasonal themes" description="Ask someone with “Manage seasonal themes” to plan festival looks." />;
}

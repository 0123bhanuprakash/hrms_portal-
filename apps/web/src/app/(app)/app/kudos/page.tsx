'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import Link from 'next/link';
import { toast } from 'sonner';
import { BarChart3, Heart, Pencil, Plus, Search, Send, ShieldCheck, Sparkles, Trophy, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { ColorInput, Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { KudosCard, ValuePill } from '@/components/engagement/kudos-card';
import { useAccess } from '@/lib/access/use-access';
import { useDirectory, useMyCard, usePersonCard } from '@/lib/company/profile';
import {
  useGiveKudos,
  useKudosFeed,
  useKudosLeaderboard,
  useKudosSuggestions,
  useKudosValues,
  useMyKudos,
  useSaveKudosValue,
  type KudosFilter,
  type KudosValue,
} from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Picked = { id: string; firstName: string; lastName: string; avatarUrl: string | null };
const PROMPTS = ['Thanks for going the extra mile on ', 'You made it so easy for us to ', 'Shout-out for '];

export default function KudosPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<KudosFilter>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('filter') === 'for-me' ? 'for-me' : 'all'));
  const [valueId, setValueId] = useState<string | undefined>();
  const [managing, setManaging] = useState(false);
  const [pickRequest, setPickRequest] = useState<Picked | null>(null);
  useEffect(() => setPage(1), [filter, valueId]);
  const enabled = hasFeature('engage.kudos') && can('kudos.view');
  const feed = useKudosFeed({ page, filter, valueId });
  const values = useKudosValues(false, enabled);
  const board = useKudosLeaderboard(enabled);
  const mine = useMyKudos(enabled);
  const suggestions = useKudosSuggestions(enabled && can('kudos.give'));
  if (!accessLoading && !enabled) return <EmptyState icon={<ShieldCheck />} title="Shout-outs aren’t available" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Shout-outs"
        description="Say thank you in public — tag a company value so it counts."
        action={
          can('kudos.manage') && (
            <div className="flex gap-2">
              <Button variant="secondary" asChild><Link href="/app/kudos/insights"><BarChart3 /> Insights</Link></Button>
              <Button variant="secondary" onClick={() => setManaging(true)}><Sparkles /> Company values</Button>
            </div>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {can('kudos.give') && <Composer values={values.data ?? []} pickRequest={pickRequest} />}
          <div className="flex flex-wrap items-center gap-2">
            {([['all', 'Everyone'], ['for-me', 'For me'], ['from-me', 'From me'], ['team', 'My team']] as Array<[KudosFilter, string]>).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={chip(filter === id)}>
                {label}{id === 'for-me' && mine.data?.thisMonth ? <span className="rounded-full bg-primary/15 px-1.5 text-[10.5px]">{mine.data.thisMonth}</span> : null}
              </button>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            {(values.data ?? []).map((v) => (
              <button key={v.id} type="button" onClick={() => setValueId(valueId === v.id ? undefined : v.id)} aria-pressed={valueId === v.id} className={chip(valueId === v.id)} style={valueId === v.id ? { borderColor: v.color, background: `${v.color}1f`, color: v.color } : undefined}>
                {v.emoji} {v.name}
              </button>
            ))}
          </div>
          {feed.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
          ) : feed.isLoadingError ? (
            <ErrorState message={getApiErrorMessage(feed.error, 'Could not load shout-outs')} onRetry={() => feed.refetch()} />
          ) : !feed.data?.data.length ? (
            <EmptyState icon={<Heart />} title={filter === 'all' && !valueId ? 'No shout-outs yet' : 'Nothing here yet'} description={filter === 'all' && !valueId ? 'Be the first to thank a colleague.' : 'Try another filter.'} />
          ) : (
            <div className="space-y-3">
              {feed.data.data.map((k) => <KudosCard key={k.id} k={k} />)}
              <Pagination page={page} totalPages={feed.data.meta.totalPages} total={feed.data.meta.total} limit={feed.data.meta.limit} onPageChange={setPage} />
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="bg-gradient-to-b from-warning-soft/50 to-surface">
            <CardHeader icon={<Trophy />} title={`Most thanked · ${new Date().toLocaleDateString(undefined, { month: 'long' })}`} />
            <div className="px-5 pb-5">
              {!board.data?.people.length ? (
                <p className="text-sm text-muted-foreground">Nobody yet this month — be the first to say thanks.</p>
              ) : (
                <ol className="divide-y divide-border">
                  {board.data.people.map((p, i) => (
                    <li key={p.employee.id} className="flex items-center gap-2.5 py-2 text-sm">
                      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold', i === 0 ? 'bg-amber-300 text-amber-950' : i === 1 ? 'bg-slate-200 text-slate-800' : i === 2 ? 'bg-orange-300 text-orange-950' : 'bg-muted')}>{i + 1}</span>
                      <PersonAvatar person={p.employee} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.employee.firstName} {p.employee.lastName}</span>
                      <span className="text-xs text-muted-foreground">{p.topValue?.emoji ?? '💛'} {p.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
          {mine.data && (
            <Card>
              <CardHeader icon={<Heart />} title="Your shout-outs" />
              <div className="space-y-3 px-5 pb-5">
                <div className="grid grid-cols-3 gap-2">
                  {[['Received', mine.data.received], ['Given', mine.data.given], ['This month', mine.data.thisMonth]].map(([l, v]) => (
                    <div key={l as string}><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>
                  ))}
                </div>
                {mine.data.values.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">{mine.data.values.map((v) => <ValuePill key={v.value.id} value={{ ...v.value, name: `${v.count}` }} />)}</div>
                )}
                <p className="text-xs text-muted-foreground">Values people thanked you for.</p>
              </div>
            </Card>
          )}
          {suggestions.data && suggestions.data.length > 0 && (
            <Card>
              <CardHeader icon={<Sparkles />} title="Someone to thank?" />
              <ul className="space-y-3 px-5 pb-5">
                {suggestions.data.map((s) => (
                  <li key={s.employee.id} className="flex items-center gap-2.5">
                    <PersonAvatar person={s.employee} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.employee.firstName} {s.employee.lastName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.reason}</span>
                    </span>
                    <Button size="icon-sm" variant="secondary" aria-label={`Thank ${s.employee.firstName}`} onClick={() => { setPickRequest({ ...s.employee }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Heart /></Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
      {managing && <ValuesDialog onClose={() => setManaging(false)} />}
    </div>
  );
}

const chip = (on: boolean) =>
  cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors', on ? 'border-primary/40 bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground');

function Composer({ values, pickRequest }: { values: KudosValue[]; pickRequest: Picked | null }) {
  const give = useGiveKudos();
  const me = useMyCard();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [valueId, setValueId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const results = useDirectory({ search: debounced, limit: 6 }, debounced.length >= 2);
  // "Send kudos" from home, the directory or a profile: /app/kudos?to=<employee id>[,<id>…] starts with those people picked
  const [toIds] = useState(() => (typeof window === 'undefined' ? [] : (new URLSearchParams(window.location.search).get('to') ?? '').split(',').filter(Boolean).slice(0, 10)));
  const add = (p: Picked) => setPicked((cur) => (cur.some((x) => x.id === p.id) || p.id === me.data?.employee?.id ? cur : [...cur, p]));
  useEffect(() => {
    if (pickRequest) add(pickRequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickRequest]);
  const options = useMemo(() => (results.data?.data ?? []).filter((p) => p.id !== me.data?.employee?.id && !picked.some((x) => x.id === p.id)), [results.data, picked, me.data]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await give.mutateAsync({ recipientIds: picked.map((p) => p.id), message, valueId });
      toast.success(<>Shout-out sent to {picked.map((p) => p.firstName).join(', ')} <Emoji e="🎉" play="appear" /></>);
      setPicked([]);
      setMessage('');
      setValueId(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send the shout-out'));
    }
  };

  return (
    <Card>
      {toIds.map((id) => <PresetPerson key={id} id={id} meId={me.data?.employee?.id} onReady={add} />)}
      <form onSubmit={send} className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-input bg-surface px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
          <Heart className="h-4 w-4 text-pink-500" />
          {picked.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft py-0.5 pl-0.5 pr-2 text-xs font-medium text-primary-soft-foreground">
              <PersonAvatar person={p} size="xs" /> {p.firstName} {p.lastName}
              <button type="button" aria-label={`Remove ${p.firstName}`} onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))}><X className="h-3 w-3" /></button>
            </span>
          ))}
          {picked.length < 10 && (
            <div className="relative min-w-[12rem] flex-1">
              <input placeholder={picked.length ? 'Add more people…' : 'Who do you want to thank?'} value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 w-full bg-transparent text-sm outline-none" aria-label="Search colleagues" />
              {debounced.length >= 2 && options.length > 0 && (
                <ul className="absolute left-0 z-10 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-raised shadow-menu">
                  {options.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-subtle" onClick={() => { add(p); setSearch(''); }}>
                        <PersonAvatar person={p} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.firstName} {p.lastName}</span>
                          <span className="block truncate text-xs text-muted-foreground">{p.designation?.name ?? p.email}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        {values.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Company value">
            {values.map((v) => {
              const on = valueId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={v.description ?? undefined}
                  onClick={() => setValueId(on ? null : v.id)}
                  className={cn('flex flex-col items-start gap-1 rounded-xl border-[1.5px] p-2.5 text-left transition-all', on ? 'shadow-card' : 'border-border hover:bg-subtle')}
                  style={on ? { borderColor: v.color, background: `${v.color}14` } : undefined}
                >
                  <span className="text-xl leading-none">{v.emoji}</span>
                  <span className="text-xs font-semibold" style={on ? { color: v.color } : undefined}>{v.name}</span>
                </button>
              );
            })}
          </div>
        )}
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What did they do? Be specific — it means more." rows={3} maxLength={500} minLength={3} required aria-label="Message" />
        {!message && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Need words?
            {PROMPTS.map((p) => (
              <button key={p} type="button" onClick={() => setMessage(p)} className="rounded-full border border-border px-2 py-0.5 hover:bg-subtle">{p.trim()}…</button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Everyone sees it on the wall · {picked.length ? `${picked.map((p) => p.firstName).join(', ')} and their manager${picked.length > 1 ? 's are' : ' is'} told` : 'the people you thank are told'}</span>
          <Button type="submit" loading={give.isPending} disabled={!picked.length || message.trim().length < 3}><Send /> Send shout-out</Button>
        </div>
      </form>
    </Card>
  );
}

function ValuesDialog({ onClose }: { onClose: () => void }) {
  const values = useKudosValues(true);
  const save = useSaveKudosValue();
  const [editing, setEditing] = useState<(Omit<KudosValue, 'id'> & { id?: string }) | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await save.mutateAsync(editing);
      toast.success('Value saved');
      setEditing(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Modal open onClose={onClose} icon={<Sparkles />} title="Company values" description="People tag shout-outs with these." size="md" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {editing ? (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[80px_1fr]">
          <Field label="Emoji" htmlFor="kv-emoji"><Input id="kv-emoji" value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} maxLength={8} required /></Field>
          <Field label="Name" htmlFor="kv-name"><Input id="kv-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} minLength={2} maxLength={40} required /></Field>
          <Field label="Description" htmlFor="kv-desc" className="sm:col-span-2"><Input id="kv-desc" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value || null })} maxLength={200} /></Field>
          <Field label="Colour" htmlFor="kv-color"><ColorInput id="kv-color" value={editing.color} onChange={(c) => setEditing({ ...editing, color: c })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Active
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Back</Button>
            <Button type="submit" loading={save.isPending}>Save value</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <ul className="divide-y divide-border">
            {(values.data ?? []).map((v) => (
              <li key={v.id} className={cn('flex items-center gap-3 py-2', !v.isActive && 'opacity-50')}>
                <span className="text-lg">{v.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{v.name}</span>
                  {v.description && <span className="block truncate text-xs text-muted-foreground">{v.description}</span>}
                </span>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${v.name}`} onClick={() => setEditing(v)}><Pencil /></Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" onClick={() => setEditing({ name: '', emoji: '⭐', description: null, color: '#6366F1', isActive: true, sortOrder: 100 })}><Plus /> Add value</Button>
        </div>
      )}
    </Modal>
  );
}

/** Adds a person named in ?to= once their card loads. */
function PresetPerson({ id, meId, onReady }: { id: string; meId?: string; onReady: (p: Picked) => void }) {
  const card = usePersonCard(id);
  useEffect(() => {
    const p = card.data;
    if (p) onReady({ id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.data, meId]);
  return null;
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Heart, Pencil, Plus, Search, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { ColorInput, Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { KudosCard } from '@/components/engagement/kudos-card';
import { useAccess } from '@/lib/access/use-access';
import { useDirectory, useMyCard } from '@/lib/company/profile';
import { useGiveKudos, useKudosFeed, useKudosValues, useSaveKudosValue, type KudosValue } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

export default function KudosPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState(false);
  const feed = useKudosFeed({ page });
  if (!accessLoading && !(hasFeature('engage.kudos') && can('kudos.view'))) return <EmptyState icon={<ShieldCheck />} title="Kudos aren’t available" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Kudos"
        description="Say thank you in public. Everyone in the company sees it."
        action={can('kudos.manage') && <Button variant="secondary" onClick={() => setManaging(true)}><Sparkles /> Company values</Button>}
      />
      {can('kudos.give') && <Composer />}
      {feed.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : feed.isError ? (
        <ErrorState message={getApiErrorMessage(feed.error, 'Could not load kudos')} onRetry={() => feed.refetch()} />
      ) : !feed.data?.data.length ? (
        <EmptyState icon={<Heart />} title="No kudos yet" description="Be the first to thank a colleague." />
      ) : (
        <div className="space-y-3">
          {feed.data.data.map((k) => <KudosCard key={k.id} k={k} />)}
          <Pagination page={page} totalPages={feed.data.meta.totalPages} total={feed.data.meta.total} limit={feed.data.meta.limit} onPageChange={setPage} />
        </div>
      )}
      {managing && <ValuesDialog onClose={() => setManaging(false)} />}
    </div>
  );
}

function Composer() {
  const give = useGiveKudos();
  const values = useKudosValues();
  const me = useMyCard();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null }>>([]);
  const [valueId, setValueId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const results = useDirectory({ search: debounced, limit: 6 }, debounced.length >= 2);
  const options = useMemo(
    () => (results.data?.data ?? []).filter((p) => p.id !== me.data?.employee?.id && !picked.some((x) => x.id === p.id)),
    [results.data, picked, me.data],
  );

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await give.mutateAsync({ recipientIds: picked.map((p) => p.id), message, valueId });
      toast.success(`Kudos sent to ${picked.map((p) => p.firstName).join(', ')} 🎉`);
      setPicked([]);
      setMessage('');
      setValueId(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send kudos'));
    }
  };

  return (
    <Card>
      <CardHeader icon={<Heart />} title="Give kudos" />
      <form onSubmit={send} className="space-y-3 px-5 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {picked.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft py-0.5 pl-0.5 pr-2 text-xs font-medium text-primary-soft-foreground">
                <PersonAvatar person={p} size="xs" /> {p.firstName} {p.lastName}
                <button type="button" aria-label={`Remove ${p.firstName}`} onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          {picked.length < 10 && (
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Who do you want to thank?" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search colleagues" />
              {debounced.length >= 2 && options.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-raised shadow-menu">
                  {options.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-subtle" onClick={() => { setPicked((x) => [...x, p]); setSearch(''); }}>
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
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(values.data ?? []).map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={valueId === v.id}
              title={v.description ?? undefined}
              onClick={() => setValueId(valueId === v.id ? null : v.id)}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', valueId === v.id ? 'text-white' : 'border-border hover:bg-subtle')}
              style={valueId === v.id ? { backgroundColor: v.color, borderColor: v.color } : undefined}
            >
              {v.emoji} {v.name}
            </button>
          ))}
        </div>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What did they do? Be specific — it means more." rows={3} maxLength={500} minLength={3} required aria-label="Message" />
        <div className="flex justify-end">
          <Button type="submit" loading={give.isPending} disabled={!picked.length || message.trim().length < 3}><Send /> Send kudos</Button>
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
    <Modal open onClose={onClose} icon={<Sparkles />} title="Company values" description="People tag kudos with these." className="sm:max-w-lg" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
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

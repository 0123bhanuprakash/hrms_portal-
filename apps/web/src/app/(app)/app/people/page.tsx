'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import Link from 'next/link';
import { Building2, LayoutGrid, List, MapPin, Search, ShieldCheck, Users, UsersRound, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { inputClass } from '@/components/ui/field';
import { Photo, PhotoCard, StatusPill, TODAY, todayText } from '@/components/people/photo-card';
import { QuickLook } from '@/components/people/quick-look';
import { useAccess } from '@/lib/access/use-access';
import { useDepartments, useLocations } from '@/lib/company/org';
import { useDirectory, usePeopleHighlights, type DirectoryPerson, type TodayStatus } from '@/lib/company/profile';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

type View = 'cards' | 'teams' | 'list';
const isView = (v: unknown): v is View => v === 'cards' || v === 'teams' || v === 'list';
type Chip = { key: string; label: string; status?: TodayStatus; group?: 'new' | 'mine' };
const CHIPS: Chip[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'in', label: 'Checked in', status: 'in' },
  { key: 'wfh', label: 'From home', status: 'wfh' },
  { key: 'away', label: 'Away today', status: 'away' },
  { key: 'new', label: 'New joiners', group: 'new' },
  { key: 'mine', label: 'My team', group: 'mine' },
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function PeopleDirectoryPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = can('org.view') && hasFeature('people.directory');
  const [view, setView] = useUiState<View>('people:view', 'cards', isView);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [chip, setChip] = useState('everyone');
  const [letter, setLetter] = useState('');
  const [sort, setSort] = useState<'name' | 'joined'>('name');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, departmentId, locationId, chip, letter, sort, view]);
  // "/" jumps to the search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const active = CHIPS.find((c) => c.key === chip)!;
  const teams = view === 'teams';
  const list = useDirectory(
    {
      search: debounced || undefined,
      departmentId: departmentId || undefined,
      locationId: locationId || undefined,
      status: active.status,
      group: active.group,
      letter: letter || undefined,
      sort,
      page: teams ? 1 : page,
      limit: teams ? 200 : view === 'list' ? 50 : 24,
    },
    allowed,
  );
  const highlights = usePeopleHighlights(allowed);
  const departments = useDepartments();
  const locations = useLocations();
  // Full profiles only for people who can see beyond themselves (the API re-checks)
  const viewScope = scopeOf('employee.view');
  const canOpenProfile = Boolean(viewScope && viewScope !== 'own');
  const counts = list.data?.meta.counts;
  const letters = new Set(list.data?.meta.letters ?? []);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="The people directory isn’t available to you." />;
  const h = highlights.data;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People"
        title="Directory"
        description={h ? `${h.total} colleagues · find people, see who’s in today, say thanks` : 'Find colleagues — names, roles, teams and work email.'}
        action={
          <div className="flex rounded-lg border border-border bg-surface p-0.5" role="radiogroup" aria-label="View">
            {([['cards', LayoutGrid, 'Cards'], ['teams', UsersRound, 'Teams'], ['list', List, 'List']] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold', view === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        }
      />

      {h && (
        <div className="m-stagger grid gap-3 md:grid-cols-3">
          <Card className="flex items-center gap-3 p-4">
            <span className="flex">{h.newJoiners.slice(0, 3).map((p, i) => <button key={p.id} type="button" onClick={() => setOpen(p.id)} className={cn('rounded-full ring-2 ring-surface', i > 0 && '-ml-2.5')}><Photo person={p} className="h-10 w-10" rounded="rounded-full" textClass="text-xs" /></button>)}</span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{h.newJoiners.length ? `${h.newJoiners.length} new this month` : 'No new joiners this month'}</b>
              <span className="block truncate text-xs text-muted-foreground">{h.newJoiners.length ? `${h.newJoiners.slice(0, 2).map((p) => p.firstName).join(' and ')}${h.newJoiners.length > 2 ? ' and more' : ''} — say hello` : 'Newcomers show up here'}</span>
            </span>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <span className="text-2xl"><Emoji e="🎂" play="appear" /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{h.birthdays.find((b) => b.inDays === 0) ? `${h.birthdays.filter((b) => b.inDays === 0).map((b) => b.firstName).join(', ')}’s birthday today` : h.birthdays.length ? `${h.birthdays.length} birthday${h.birthdays.length === 1 ? '' : 's'} this week` : 'No birthdays this week'}</b>
              <span className="block truncate text-xs text-muted-foreground">{h.birthdays.filter((b) => b.inDays > 0).slice(0, 2).map((b) => `${b.firstName} in ${b.inDays} day${b.inDays === 1 ? '' : 's'}`).join(' · ') || 'Day and month only'}</span>
            </span>
            {h.birthdays[0] && h.birthdays[0].inDays === 0 && <Link href={`/app/kudos?to=${h.birthdays[0].id}`} className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-subtle">Wish</Link>}
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <span className="flex">{h.away.slice(0, 3).map((p, i) => <button key={p.id} type="button" onClick={() => setOpen(p.id)} className={cn('rounded-full ring-2 ring-surface', i > 0 && '-ml-2.5')}><Photo person={p} className="h-10 w-10" rounded="rounded-full" textClass="text-xs" /></button>)}</span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{h.workingDay ? `${h.counts.away} away today` : h.holiday ? `Holiday — ${h.holiday}` : 'Weekend'}</b>
              <span className="block truncate text-xs text-muted-foreground">{h.counts.in} checked in · {h.counts.wfh} from home{h.counts.out ? ` · ${h.counts.out} checked out` : ''}</span>
            </span>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, role, team, email or ID" aria-label="Search people" className={cn(inputClass, 'h-11 rounded-xl pl-10 pr-16 text-sm')} />
          {search ? (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 text-[11px] text-muted-foreground">/</kbd>
          )}
        </label>
        <label className="relative">
          <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Select className={cn(inputClass, 'h-11 w-auto rounded-xl pl-8 text-sm', departmentId && 'border-primary/40 text-primary')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Team">
            <option value="">All teams</option>
            {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </label>
        {locations.data && locations.data.length > 0 && (
          <label className="relative">
            <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Select className={cn(inputClass, 'h-11 w-auto rounded-xl pl-8 text-sm', locationId && 'border-primary/40 text-primary')} value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
              <option value="">All locations</option>
              {locations.data.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((c) => {
          const n = counts ? (c.key === 'everyone' ? counts.everyone : counts[c.key as keyof typeof counts]) : undefined;
          if (c.key === 'mine' && !n) return null;
          return (
            <button key={c.key} type="button" onClick={() => setChip(c.key)} aria-pressed={chip === c.key} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors', chip === c.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface hover:bg-subtle')}>
              {c.status && <i className={cn('h-1.5 w-1.5 rounded-full', TODAY[c.status].dot)} />}
              {c.label}
              {n !== undefined && <span className={cn('tabular-nums', chip === c.key ? 'opacity-80' : 'text-muted-foreground')}>{n}</span>}
            </button>
          );
        })}
        {letter && <button type="button" onClick={() => setLetter('')} className="inline-flex h-8 items-center gap-1 rounded-full border border-primary/40 bg-primary-soft px-3 text-xs font-semibold text-primary-soft-foreground">Starts with {letter} <X className="h-3 w-3" /></button>}
        <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'joined')} className="ml-auto h-8 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-muted-foreground">
          <option value="name">A–Z</option>
          <option value="joined">Newest first</option>
        </Select>
      </div>

      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}</div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load the directory')} onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState icon={<Users />} title="No one found" description={debounced || chip !== 'everyone' || letter ? 'Try another name or clear the filters.' : undefined} />
      ) : (
        <div className={cn('flex gap-3 transition-opacity', list.isFetching && 'opacity-70')}>
          <div className="min-w-0 flex-1 space-y-4">
            {view === 'cards' && (
              <ul className="m-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.data.data.map((p) => <li key={p.id}><PhotoCard person={p} onOpen={() => setOpen(p.id)} /></li>)}
              </ul>
            )}
            {view === 'teams' && <TeamsView people={list.data.data} onOpen={setOpen} total={list.data.meta.total} />}
            {view === 'list' && <ListView people={list.data.data} onOpen={setOpen} />}
            {!teams && <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />}
          </div>
          <nav aria-label="Jump to letter" className="sticky top-20 hidden h-max flex-col items-center gap-px self-start sm:flex">
            {LETTERS.map((l) => (
              <button key={l} type="button" disabled={!letters.has(l) && letter !== l} onClick={() => setLetter(letter === l ? '' : l)} className={cn('h-5 w-6 rounded text-[10.5px] font-bold', letter === l ? 'bg-primary text-primary-foreground' : letters.has(l) ? 'text-foreground hover:bg-subtle' : 'text-muted-foreground/30')}>
                {l}
              </button>
            ))}
          </nav>
        </div>
      )}
      <QuickLook id={open} onClose={() => setOpen(null)} onOpen={setOpen} canOpenProfile={canOpenProfile} />
    </div>
  );
}

function TeamsView({ people, onOpen, total }: { people: DirectoryPerson[]; onOpen: (id: string) => void; total: number }) {
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; people: DirectoryPerson[] }>();
    for (const p of people) {
      const key = p.department?.id ?? 'none';
      const g = m.get(key) ?? { name: p.department?.name ?? 'No team yet', people: [] };
      g.people.push(p);
      m.set(key, g);
    }
    return [...m.entries()].sort((a, b) => b[1].people.length - a[1].people.length);
  }, [people]);
  return (
    <div className="space-y-3">
      <div className="m-stagger grid gap-4 lg:grid-cols-2">
        {groups.map(([key, g]) => (
          <Card key={key} className="flex flex-col gap-3 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">{g.name}<span className="rounded-full bg-muted px-2 text-[11px] font-bold">{g.people.length}</span></h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {g.people.map((p) => (
                <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="group text-center" title={p.today ? todayText(p.today) : undefined}>
                  <span className="relative mx-auto block w-max">
                    <Photo person={p} className="h-16 w-16 transition-transform group-hover:scale-105" rounded="rounded-2xl" textClass="text-base" />
                    {p.today && <i className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface', TODAY[p.today.status].dot)} />}
                  </span>
                  <span className="mt-1.5 block truncate text-xs font-semibold">{p.firstName}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{p.designation?.name ?? ''}</span>
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {total > people.length && <p className="text-xs text-muted-foreground">Showing {people.length} of {total} — pick a team or search to narrow it down.</p>}
    </div>
  );
}

function ListView({ people, onOpen }: { people: DirectoryPerson[]; onOpen: (id: string) => void }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-2.5 font-semibold">Name</th>
            <th className="px-3 py-2.5 font-semibold">Role</th>
            <th className="px-3 py-2.5 font-semibold">Team</th>
            <th className="px-3 py-2.5 font-semibold">Location</th>
            <th className="px-3 py-2.5 font-semibold">Today</th>
            <th className="px-3 py-2.5 font-semibold">Reports to</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {people.map((p) => (
            <tr key={p.id} onClick={() => onOpen(p.id)} className="cursor-pointer hover:bg-subtle">
              <td className="px-4 py-2">
                <span className="flex items-center gap-2.5">
                  <Photo person={p} className="h-8 w-8" rounded="rounded-lg" textClass="text-[11px]" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.firstName} {p.lastName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                  </span>
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{p.designation?.name ?? '—'}</td>
              <td className="px-3 py-2">{p.department?.name ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.location?.name ?? '—'}</td>
              <td className="px-3 py-2">{p.today && <StatusPill today={p.today} className="shadow-none" />}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.reportingManager ? `${p.reportingManager.firstName} ${p.reportingManager.lastName}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

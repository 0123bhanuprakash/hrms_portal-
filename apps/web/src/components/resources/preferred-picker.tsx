'use client';

import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, SearchX, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Pagination, Skeleton } from '@/components/ui/feedback';
import { inputClass } from '@/components/ui/field';
import { Select } from '@/components/ui/pickers';
import { SearchField, useDebounced } from '@/components/ui/list-tools';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAvailablePeople, type AvailablePerson } from '@/lib/company/resources';
import { cn } from '@/lib/cn';

const AVAILABILITY = [
  { key: '', label: 'Any free time' },
  { key: '25', label: '25%+ free' },
  { key: '50', label: '50%+ free' },
  { key: '75', label: '75%+ free' },
  { key: '100', label: 'Fully free' },
] as const;
const EXPERIENCE = [
  { key: '', label: 'Any experience' },
  { key: '0-2', label: 'Under 2 years' },
  { key: '2-5', label: '2–5 years' },
  { key: '5-8', label: '5–8 years' },
  { key: '8-', label: '8+ years' },
] as const;

const years = (n: number) => (n < 1 ? `${Math.max(1, Math.round(n * 12))} mo` : `${n % 1 ? n.toFixed(1) : n} yr${n === 1 ? '' : 's'}`);

/**
 * Raise a request → "Preferred person": only people with free time in the
 * request's dates, most free first, with skills (matches first), experience
 * and current projects. Filters: department, role, availability, experience, skills.
 */
export function PreferredPicker({ projectId, from, until, wanted, value, onChange }: { projectId: string; from: string; until: string | null; wanted: string[]; value: AvailablePerson | null; onChange: (p: AvailablePerson | null) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deptId, setDeptId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [minFree, setMinFree] = useState('');
  const [exp, setExp] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const typed = useDebounced(search.trim(), 300);
  const [minYears, maxYears] = exp ? exp.split('-').map((x) => (x === '' ? undefined : Number(x))) : [undefined, undefined];
  const q = useAvailablePeople(
    { projectId, from, until, search: typed || undefined, departmentId: deptId || undefined, designationId: roleId || undefined, minFree: minFree ? Number(minFree) : undefined, minYears, maxYears, skills: skills.join(',') || undefined, wanted: wanted.join(',') || undefined, page, limit: 12 },
    open,
  );
  // Any filter change starts again at page 1
  useEffect(() => setPage(1), [typed, deptId, roleId, minFree, exp, skills, from, until]);
  const facets = q.data?.meta.facets;
  const filtered = Boolean(typed || deptId || roleId || minFree || exp || skills.length);
  const clear = () => { setSearch(''); setDeptId(''); setRoleId(''); setMinFree(''); setExp(''); setSkills([]); };
  const field = cn(inputClass, 'h-8 w-auto py-0 text-xs');
  const toggleSkill = (s: string) => setSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary-soft/30 p-2.5">
          <PersonRow p={value} wanted={wanted} compact />
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Change</Button>
          <Button size="icon-sm" variant="ghost" aria-label="No preference" onClick={() => onChange(null)}><X /></Button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground">
          <Sparkles className="h-4 w-4" /> Choose from people free in these dates <span className="ml-auto text-xs">(optional)</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      )}

      {open && (
        <div className="space-y-2.5 rounded-xl border border-border bg-subtle/30 p-3">
          <div className="flex flex-wrap items-start gap-2">
            <SearchField className="w-full sm:w-48" value={search} onChange={setSearch} placeholder="Name, ID or role" label="Search people" />
            <Select overlay aria-label="Department" className={field} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
              <option value="">All departments</option>
              {(facets?.departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name} ({d.count})</option>)}
            </Select>
            <Select overlay aria-label="Role" className={field} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">All roles</option>
              {(facets?.roles ?? []).map((d) => <option key={d.id} value={d.id}>{d.name} ({d.count})</option>)}
            </Select>
            <Select overlay aria-label="Availability" className={field} value={minFree} onChange={(e) => setMinFree(e.target.value)}>
              {AVAILABILITY.map((a) => <option key={a.key || 'any'} value={a.key}>{a.label}</option>)}
            </Select>
            <Select overlay aria-label="Experience" className={field} value={exp} onChange={(e) => setExp(e.target.value)}>
              {EXPERIENCE.map((a) => <option key={a.key || 'any'} value={a.key}>{a.label}</option>)}
            </Select>
            {filtered && <Button size="sm" variant="ghost" className="h-8" onClick={clear}><X /> Clear</Button>}
          </div>
          {(facets?.skills.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Skills">
              <span className="mr-1 text-xs text-muted-foreground">Skills:</span>
              {[...new Set([...skills, ...(facets?.skills ?? []).slice(0, 14).map((s) => s.id)])].map((id) => {
                const f = facets?.skills.find((s) => s.id === id);
                const on = skills.includes(id);
                return (
                  <button key={id} type="button" aria-pressed={on} onClick={() => toggleSkill(id)} className={cn('rounded-full border px-2 py-0.5 text-xs', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted', wanted.some((w) => w.toLowerCase() === id) && !on && 'border-primary/50 text-primary')}>
                    {f?.name ?? id}{f ? ` ${f.count}` : ''}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Free {q.data ? `${q.data.window.from}${q.data.window.until ? ` → ${q.data.window.until}` : ' onwards'}` : 'in your dates'} · most free first{q.data ? ` · ${q.data.meta.total} ${q.data.meta.total === 1 ? 'person' : 'people'}` : ''}
          </p>
          {q.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !q.data?.rows.length ? (
            <EmptyState icon={<SearchX />} title={filtered ? 'Nobody free matches these filters' : 'Nobody is free in these dates'} description={filtered ? 'Try fewer filters.' : 'Try other dates, or send the request without a preference — the PMO can still find someone.'} action={filtered ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />
          ) : (
            <ul className={cn('max-h-[22rem] space-y-1.5 overflow-y-auto pr-1', q.isFetching && 'opacity-70')}>
              {q.data.rows.map((p) => (
                <li key={p.employee.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(p); setOpen(false); }}
                    className={cn('flex w-full items-start gap-3 rounded-lg border bg-surface p-2.5 text-left transition-colors hover:border-primary/40', value?.employee.id === p.employee.id ? 'border-primary' : 'border-border')}
                  >
                    <PersonRow p={p} wanted={wanted} />
                    {value?.employee.id === p.employee.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.data && q.data.meta.totalPages > 1 && <Pagination page={page} totalPages={q.data.meta.totalPages} total={q.data.meta.total} limit={q.data.meta.limit} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}

/** Face, role · department, experience, free %, skills (matches first) and current projects. */
function PersonRow({ p, wanted, compact }: { p: AvailablePerson; wanted: string[]; compact?: boolean }) {
  const want = new Set(wanted.map((w) => w.toLowerCase()));
  const matched = new Set(p.matchedSkills.map((s) => s.toLowerCase()));
  const skills = [...p.skills].sort((a, b) => Number(matched.has(b.toLowerCase())) - Number(matched.has(a.toLowerCase())));
  const shown = compact ? skills.filter((s) => matched.has(s.toLowerCase())).slice(0, 4) : skills.slice(0, 8);
  const tone = p.free >= 100 ? 'bg-success' : p.free >= 50 ? 'bg-info' : 'bg-warning';
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <PersonAvatar person={p.employee} size="sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{p.employee.firstName} {p.employee.lastName}</span>
          <span className="truncate text-xs text-muted-foreground">{[p.employee.designation?.name, p.employee.department?.name].filter(Boolean).join(' · ') || p.employee.employeeId}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" title={`${p.free}% of their week is free in these dates`}>
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', tone)} style={{ width: `${p.free}%` }} /></span>
            <b className="font-semibold text-foreground">{p.free}%</b> free
          </span>
          <span title={p.experienceComplete ? 'Experience before joining + time here' : 'Only time here — experience before joining not given'}>{years(p.experienceYears)}{p.experienceComplete ? ' experience' : ' here'}</span>
          {!compact && p.projects.length > 0 && <span className="truncate">On {p.projects.map((x) => `${x.code} ${x.allocation}%`).join(', ')}</span>}
        </div>
        {shown.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shown.map((s) => (
              <Badge key={s} tone={matched.has(s.toLowerCase()) || want.has(s.toLowerCase()) ? 'primary' : 'neutral'} className="px-1.5 py-0 text-[11px]">{s}</Badge>
            ))}
            {!compact && p.skills.length > shown.length && <span className="text-[11px] text-muted-foreground">+{p.skills.length - shown.length}</span>}
          </div>
        )}
        {!compact && !p.skills.length && <p className="text-[11px] text-muted-foreground">No skills listed on their profile</p>}
      </div>
    </div>
  );
}

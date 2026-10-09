'use client';

import React, { useMemo, useState } from 'react';
import { Gift, Users, UserCheck, X } from 'lucide-react';
import { SearchSelect, type PickOption } from '@/components/ui/pickers';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useDebounced } from '@/components/ui/list-tools';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { PersonSearch } from '@/components/people/person-search';
import { useDepartments, useDesignations, useLocations, usePeopleByIds } from '@/lib/company/org';
import { useProjects } from '@/lib/company/projects';
import { useEligibilityPreview, type EmploymentType, type Gender, type LeaveAvailability, type LeaveRules } from '@/lib/company/leave';
import { cn } from '@/lib/cn';

// ============================================================
// "Who can use it" — everyone, people matching rules, or only
// people HR grants it to. Rules: empty = anyone; different rules
// combine with AND, values inside one rule with OR.
// ============================================================

export const NO_RULES: LeaveRules = {
  genders: [],
  departmentIds: [],
  locationIds: [],
  designationIds: [],
  employmentTypes: [],
  minServiceMonths: null,
  managerIds: [],
  managerDeep: false,
  projectIds: [],
  members: [],
};

/** Only the rule fields (callers may pass a whole leave type form). */
export const pickRules = (r: LeaveRules): LeaveRules => ({
  genders: r.genders,
  departmentIds: r.departmentIds,
  locationIds: r.locationIds,
  designationIds: r.designationIds,
  employmentTypes: r.employmentTypes,
  minServiceMonths: r.minServiceMonths,
  managerIds: r.managerIds,
  managerDeep: r.managerDeep,
  projectIds: r.projectIds,
  members: r.members,
});

const GENDERS: Array<[Gender, string]> = [['FEMALE', 'Women'], ['MALE', 'Men'], ['OTHER', 'Other']];
const EMPLOYMENT: Array<[EmploymentType, string]> = [['FULL_TIME', 'Full-time'], ['PART_TIME', 'Part-time'], ['CONTRACT', 'Contract'], ['INTERN', 'Intern']];

const MODES: Array<{ id: LeaveAvailability; title: string; hint: string; icon: React.ReactNode }> = [
  { id: 'EVERYONE', title: 'Everyone', hint: 'Every employee gets it', icon: <Users /> },
  { id: 'RULES', title: 'Only some people', hint: 'Team, office, gender, named people…', icon: <UserCheck /> },
  { id: 'GRANT_ONLY', title: 'Only when granted', hint: 'HR gives it to a person, e.g. maternity', icon: <Gift /> },
];

/** Badge text for a type's rules, e.g. "Women · 2 offices · 3+ months". */
export function rulesSummary(t: { availability: LeaveAvailability } & Partial<LeaveRules>): string | null {
  if (t.availability === 'EVERYONE') return null;
  const parts: string[] = [];
  const n = (list: unknown[] | undefined, one: string, many: string) => (list?.length ? (list.length === 1 ? `1 ${one}` : `${list.length} ${many}`) : null);
  if (t.genders?.length) parts.push(t.genders.map((g) => GENDERS.find(([k]) => k === g)?.[1] ?? g).join(' / '));
  for (const p of [n(t.departmentIds, 'department', 'departments'), n(t.locationIds, 'office', 'offices'), n(t.designationIds, 'designation', 'designations')]) if (p) parts.push(p);
  if (t.employmentTypes?.length) parts.push(t.employmentTypes.map((e) => EMPLOYMENT.find(([k]) => k === e)?.[1] ?? e).join(' / '));
  if (t.minServiceMonths) parts.push(`${t.minServiceMonths}+ months`);
  const mgr = n(t.managerIds, 'team', 'teams');
  if (mgr) parts.push(mgr);
  const proj = n(t.projectIds, 'project', 'projects');
  if (proj) parts.push(proj);
  const inc = t.members?.filter((m) => m.mode === 'INCLUDE').length ?? 0;
  const exc = t.members?.filter((m) => m.mode === 'EXCLUDE').length ?? 0;
  if (inc) parts.push(`+${inc} named`);
  if (exc) parts.push(`−${exc} named`);
  return parts.join(' · ') || null;
}

/** Chips for the chosen values + a search box that adds one more. */
function MultiChips({ id, options, values, onChange, placeholder, onSearch, searching }: { id: string; options: PickOption[]; values: string[]; onChange: (v: string[]) => void; placeholder: string; onSearch?: (q: string) => void; searching?: boolean }) {
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? '…';
  return (
    <div className="space-y-1.5">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary-soft-foreground">
              {label(v)}
              <button type="button" className="rounded-full p-0.5 hover:bg-primary/15" aria-label={`Remove ${label(v)}`} onClick={() => onChange(values.filter((x) => x !== v))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <SearchSelect
        id={id}
        overlay
        value=""
        onChange={(v) => v && !values.includes(v) && onChange([...values, v])}
        options={options.filter((o) => !values.includes(o.value))}
        placeholder={values.length ? 'Add another…' : placeholder}
        searchable
        onSearch={onSearch}
        searching={searching}
      />
    </div>
  );
}

/** Chosen people as chips with photos + a search to add more. */
function PeopleChips({ id, values, onChange, placeholder, managers, hide }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; managers?: boolean; hide?: string[] }) {
  const people = usePeopleByIds(values);
  const byId = new Map((people.data ?? []).map((p) => [p.id, p]));
  return (
    <div className="space-y-1.5">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => {
            const p = byId.get(v);
            const name = p ? `${p.firstName} ${p.lastName}` : '…';
            return (
              <span key={v} className="inline-flex items-center gap-1 rounded-full bg-subtle py-0.5 pl-0.5 pr-1 text-xs font-medium">
                {p && <PersonAvatar person={p} size="xs" />} {name}
                <button type="button" className="rounded-full p-0.5 hover:bg-muted" aria-label={`Remove ${name}`} onClick={() => onChange(values.filter((x) => x !== v))}><X className="h-3 w-3" /></button>
              </span>
            );
          })}
        </div>
      )}
      <PersonSearch id={id} overlay value="" managers={managers} hide={[...values, ...(hide ?? [])]} onChange={(v) => v && onChange([...values, v])} placeholder={values.length ? 'Add someone…' : placeholder} />
    </div>
  );
}

export function WhoCanUse({
  availability,
  rules,
  onAvailability,
  onRules,
  grantNeedsDocument,
  onGrantNeedsDocument,
}: {
  availability: LeaveAvailability;
  rules: LeaveRules;
  onAvailability: (a: LeaveAvailability) => void;
  onRules: (r: LeaveRules) => void;
  grantNeedsDocument: boolean;
  onGrantNeedsDocument: (v: boolean) => void;
}) {
  const departments = useDepartments();
  const designations = useDesignations();
  const locations = useLocations();
  const [projectQ, setProjectQ] = useState('');
  const projectSearch = useDebounced(projectQ.trim(), 250);
  const projects = useProjects({ search: projectSearch || undefined });
  const [showWho, setShowWho] = useState(false);
  const set = <K extends keyof LeaveRules>(k: K, v: LeaveRules[K]) => onRules({ ...rules, [k]: v });

  // Live "applies to N people" — debounced so typing in the form doesn't spam the API
  const draft = useDebounced(useMemo(() => ({ availability, ...pickRules(rules) }), [availability, rules]), 400);
  const preview = useEligibilityPreview(availability === 'EVERYONE' ? null : draft);
  const projectNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of preview.data?.projects ?? []) m.set(p.id, p.name);
    for (const p of projects.data?.data ?? []) m.set(p.id, p.name);
    return m;
  }, [preview.data, projects.data]);

  const included = rules.members.filter((m) => m.mode === 'INCLUDE').map((m) => m.employeeId);
  const excluded = rules.members.filter((m) => m.mode === 'EXCLUDE').map((m) => m.employeeId);
  const setMembers = (mode: 'INCLUDE' | 'EXCLUDE', ids: string[]) =>
    set('members', [...rules.members.filter((m) => m.mode !== mode && !ids.includes(m.employeeId)), ...ids.map((employeeId) => ({ employeeId, mode }))]);
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const pill = (on: boolean) => cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle');

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Who can use it</p>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Who can use it">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={availability === m.id}
            onClick={() => onAvailability(m.id)}
            className={cn('flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0', availability === m.id ? 'border-primary bg-primary-soft/60 ring-1 ring-primary' : 'border-border hover:bg-subtle')}
          >
            {m.icon}
            <span><span className="block text-sm font-semibold">{m.title}</span><span className="block text-xs text-muted-foreground">{m.hint}</span></span>
          </button>
        ))}
      </div>

      {availability !== 'EVERYONE' && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {availability === 'RULES'
              ? 'People who match every rule you set get it. Leave a rule empty to allow anyone.'
              : 'Nobody has it until HR grants it. The rules below decide who may ask HR for it.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gender" htmlFor="wcu-gender">
              <div id="wcu-gender" className="flex flex-wrap gap-1.5">
                {GENDERS.map(([g, label]) => <button key={g} type="button" aria-pressed={rules.genders.includes(g)} className={pill(rules.genders.includes(g))} onClick={() => set('genders', toggle(rules.genders, g))}>{label}</button>)}
              </div>
            </Field>
            <Field label="Employment type" htmlFor="wcu-emp">
              <div id="wcu-emp" className="flex flex-wrap gap-1.5">
                {EMPLOYMENT.map(([e, label]) => <button key={e} type="button" aria-pressed={rules.employmentTypes.includes(e)} className={pill(rules.employmentTypes.includes(e))} onClick={() => set('employmentTypes', toggle(rules.employmentTypes, e))}>{label}</button>)}
              </div>
            </Field>
            <Field label="Departments" htmlFor="wcu-dept">
              <MultiChips id="wcu-dept" placeholder="Any department" values={rules.departmentIds} onChange={(v) => set('departmentIds', v)} options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
            </Field>
            <Field label="Offices" htmlFor="wcu-loc">
              <MultiChips id="wcu-loc" placeholder="Any office" values={rules.locationIds} onChange={(v) => set('locationIds', v)} options={(locations.data ?? []).map((l) => ({ value: l.id, label: l.name }))} />
            </Field>
            <Field label="Designations" htmlFor="wcu-desig">
              <MultiChips id="wcu-desig" placeholder="Any designation" values={rules.designationIds} onChange={(v) => set('designationIds', v)} options={(designations.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
            </Field>
            <Field label="Minimum service" htmlFor="wcu-service" hint="Months since joining; blank = from day one">
              <span className="flex items-center gap-2 text-sm">
                <Input id="wcu-service" type="number" min={1} max={600} className="w-24" value={rules.minServiceMonths ?? ''} onChange={(e) => set('minServiceMonths', e.target.value ? Number(e.target.value) : null)} /> months
              </span>
            </Field>
            <Field label="Manager’s team" htmlFor="wcu-mgr" hint="People who report to these managers">
              <PeopleChips id="wcu-mgr" managers placeholder="Any team" values={rules.managerIds} onChange={(v) => set('managerIds', v)} />
              {rules.managerIds.length > 0 && (
                <label className="mt-1.5 flex items-center gap-2 text-xs">
                  <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={rules.managerDeep} onChange={(e) => set('managerDeep', e.target.checked)} />
                  Include everyone further down (not only direct reports)
                </label>
              )}
            </Field>
            <Field label="Project team" htmlFor="wcu-proj" hint="Current members of these projects">
              <MultiChips
                id="wcu-proj"
                placeholder="Any project"
                values={rules.projectIds}
                onChange={(v) => set('projectIds', v)}
                options={[...projectNames].map(([value, label]) => ({ value, label }))}
                onSearch={setProjectQ}
                searching={projects.isFetching}
              />
            </Field>
          </div>
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="Also these people" htmlFor="wcu-inc" hint="Get it even if the rules don’t match">
              <PeopleChips id="wcu-inc" placeholder="Add a person" values={included} hide={excluded} onChange={(v) => setMembers('INCLUDE', v)} />
            </Field>
            <Field label="Never these people" htmlFor="wcu-exc" hint="Left out even if the rules match">
              <PeopleChips id="wcu-exc" placeholder="Add a person" values={excluded} hide={included} onChange={(v) => setMembers('EXCLUDE', v)} />
            </Field>
          </div>
          {availability === 'GRANT_ONLY' && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={grantNeedsDocument} onChange={(e) => onGrantNeedsDocument(e.target.checked)} />
              <span><span className="font-medium">A supporting document is required</span><span className="block text-xs text-muted-foreground">e.g. a medical certificate, adoption order or surrogacy agreement — asked when someone requests it and when HR grants it</span></span>
            </label>
          )}
          <div className="rounded-lg bg-subtle/80 px-3 py-2 text-sm" aria-live="polite">
            {!preview.data ? (
              <span className="text-muted-foreground">Counting people…</span>
            ) : (
              <>
                <span>
                  {availability === 'RULES' ? 'Applies to ' : 'Can ask for it: '}
                  <b>{preview.data.count}</b> of {preview.data.total} people
                </span>
                {preview.data.count > 0 && (
                  <Button variant="link" size="sm" className="ml-2 text-xs" onClick={() => setShowWho((v) => !v)}>{showWho ? 'Hide' : 'See who'}</Button>
                )}
                {showWho && (
                  <ul className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {preview.data.people.map((p) => (
                      <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-surface py-0.5 pl-0.5 pr-2.5 text-xs"><PersonAvatar person={p} size="xs" /> {p.firstName} {p.lastName}</li>
                    ))}
                    {preview.data.count > preview.data.people.length && <li className="self-center text-xs text-muted-foreground">and {preview.data.count - preview.data.people.length} more</li>}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

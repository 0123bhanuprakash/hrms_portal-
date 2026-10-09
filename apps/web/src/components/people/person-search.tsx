'use client';

import React, { useMemo, useState } from 'react';
import { SearchSelect, type PickOption, type SearchSelectProps } from '@/components/ui/pickers';
import { useDebounced } from '@/components/ui/list-tools';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { usePeopleByIds, usePeopleSearch, type PickPerson } from '@/lib/company/org';

// ============================================================
// Choose a person by typing — the server searches (20 at a time),
// so no form downloads the whole company. The chosen person is
// fetched by id so their name shows before anyone types.
// ============================================================

export type { PickPerson };

export interface PersonSearchProps extends Omit<SearchSelectProps, 'options' | 'onChange' | 'searchable' | 'onSearch' | 'searching'> {
  onChange: (id: string, person: PickPerson | null) => void;
  /** `value` is an employee id (default) or a user id (delegations) */
  by?: 'employee' | 'user';
  /** Only people who have someone reporting to them */
  managers?: boolean;
  /** Leave this employee out (e.g. yourself as your own manager) */
  exclude?: string;
  /** People to leave out by the same id as `value` */
  hide?: string[];
  /** Second line under the name (default: job title) */
  sub?: (p: PickPerson) => string | null;
  /** Fixed choices above the people (e.g. "No manager") */
  extra?: PickOption[];
}

export function PersonSearch({ value, onChange, by = 'employee', managers, exclude, hide, sub, extra, ...props }: PersonSearchProps) {
  const [q, setQ] = useState('');
  const typed = useDebounced(q.trim(), 250);
  const found = usePeopleSearch({ search: typed || undefined, managers, exclude });
  const fixed = Boolean(extra?.some((o) => o.value === value));
  const chosen = usePeopleByIds(value && !fixed ? [value] : [], by);
  const idOf = (p: PickPerson) => (by === 'user' ? p.userId : p.id);
  const people = useMemo(() => {
    const out = new Map<string, PickPerson>();
    // Keep the chosen person in the list so the field can show their name
    for (const p of chosen.data ?? []) out.set(idOf(p), p);
    for (const p of found.data ?? []) out.set(idOf(p), p);
    for (const id of hide ?? []) if (id !== value) out.delete(id);
    return [...out.values()];
  }, [chosen.data, found.data, hide, value]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(
    () => [
      ...(extra ?? []),
      ...people.map((p) => ({
        value: idOf(p),
        label: `${p.firstName} ${p.lastName}`.trim(),
        sub: sub ? sub(p) : p.designation?.name ?? p.employeeId,
        keywords: `${p.employeeId} ${p.designation?.name ?? ''} ${p.department?.name ?? ''}`,
        lead: <PersonAvatar person={p} size="xs" />,
      })),
    ],
    [people, sub, extra], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Until the chosen person loads, show a neutral placeholder rather than "Choose a person"
  const loadingChosen = Boolean(value) && !fixed && chosen.isLoading;
  return (
    <SearchSelect
      placeholder={loadingChosen ? 'Loading…' : 'Choose a person'}
      searchPlaceholder="Type a name, ID or title…"
      {...props}
      value={value}
      options={options}
      onChange={(id) => onChange(id, people.find((p) => idOf(p) === id) ?? null)}
      onSearch={setQ}
      searching={found.isFetching}
    />
  );
}

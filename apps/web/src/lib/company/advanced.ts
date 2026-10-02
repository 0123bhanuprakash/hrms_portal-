'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccessScope } from '@hrms/types';
import { api } from '@/lib/api';
import { accessKeys } from '@/lib/access/use-access';

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

// ─── Access Explorer ────────────────────────────────────────

export type GrantSource = { kind: 'role' | 'owner' | 'delegation'; id: string; name: string; scope: AccessScope | null };

export interface UserExplanation {
  user: { id: string; name: string; email: string; status: string };
  isOwner: boolean;
  roles: Array<{ id: string; key: string | null; name: string }>;
  employee: { id: string; directReports: number; allReports: number } | null;
  permissionCount: number;
  sensitiveCount: number;
  modules: Array<{
    key: string;
    label: string;
    features: Array<{
      key: string;
      label: string;
      permissions: Array<{ key: string; label: string; sensitive: boolean; scope: AccessScope | null; reach: number | null; sources: GrantSource[] }>;
    }>;
  }>;
  dormant: Array<{ key: string; label: string; feature: string }>;
  delegations: Array<{ id: string; fromName: string; until: string; permissions: Array<{ key: string; label: string; scope: AccessScope | null }> }>;
}

export interface WhoCanAccess {
  employee: { id: string; name: string };
  permission: { key: string; label: string; sensitive: boolean; scoped: boolean };
  featureEnabled: boolean;
  people: Array<{ userId: string; name: string; email: string; scope: AccessScope; reason: string; sources: GrantSource[] }>;
}

export const useExplainUser = (userId: string | null) =>
  useQuery({
    queryKey: ['explain', 'user', userId],
    queryFn: async () => unwrap<UserExplanation>(await api.get(`/access/explain/users/${userId}`)),
    enabled: Boolean(userId),
  });

export const useWhoCanAccess = (employeeId: string | null, permission: string) =>
  useQuery({
    queryKey: ['explain', 'employee', employeeId, permission],
    queryFn: async () => unwrap<WhoCanAccess>(await api.get(`/access/explain/employees/${employeeId}`, { params: { permission } })),
    enabled: Boolean(employeeId && permission),
  });

// ─── Delegations ────────────────────────────────────────────

export interface Delegation {
  id: string;
  status: 'active' | 'upcoming' | 'ended' | 'revoked';
  startsAt: string;
  endsAt: string;
  reason: string | null;
  revokedAt: string | null;
  createdAt: string;
  delegator: { id: string; name: string; email: string };
  delegate: { id: string; name: string; email: string };
}

export interface MyDelegations {
  given: Delegation[];
  received: Delegation[];
  canDelegate: boolean;
  delegable: Array<{ key: string; label: string; scope: AccessScope | null }>;
}

const delegationKeys = { mine: ['delegations', 'mine'] as const, all: ['delegations', 'all'] as const };

export const useMyDelegations = () => useQuery({ queryKey: delegationKeys.mine, queryFn: async () => unwrap<MyDelegations>(await api.get('/delegations')) });
export const useAllDelegations = (enabled: boolean) =>
  useQuery({ queryKey: delegationKeys.all, queryFn: async () => unwrap<Delegation[]>(await api.get('/delegations/all')), enabled });

function useDelegationMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['delegations'] });
      void qc.invalidateQueries({ queryKey: accessKeys.me });
    },
  });
}

export const useCreateDelegation = () =>
  useDelegationMutation(async (body: { delegateId: string; delegatorId?: string; startsAt?: string; endsAt: string; reason?: string }) =>
    unwrap<Delegation>(await api.post('/delegations', body)),
  );
export const useRevokeDelegation = () => useDelegationMutation(async (id: string) => unwrap<Delegation>(await api.delete(`/delegations/${id}`)));

// ─── Bulk import ────────────────────────────────────────────

export interface ImportRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  joiningDate?: string;
  employmentType?: string;
  department?: string;
  designation?: string;
  location?: string;
  managerEmail?: string;
}

export interface ImportPreview {
  rows: Array<{ row: number; status: 'ok' | 'warning' | 'error'; messages: string[]; name: string; email: string }>;
  summary: { total: number; ok: number; warnings: number; errors: number; importable: number };
  limit: { max: number | null; current: number; remaining: number | null; exceeded: boolean };
}

export interface ImportResult {
  created: number;
  skipped: Array<{ row: number; name: string; reasons: string[] }>;
  failed: Array<{ row: number; name: string; error: string }>;
  invitesSent: boolean;
}

export const useImportPreview = () =>
  useMutation({ mutationFn: async (rows: ImportRow[]) => unwrap<ImportPreview>(await api.post('/employees/import/preview', { rows })) });

export const useRunImport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { rows: ImportRow[]; sendInvites: boolean }) => unwrap<ImportResult>(await api.post('/employees/import', body)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['org'] }),
  });
};

// ─── CSV ────────────────────────────────────────────────────

export const IMPORT_COLUMNS: Array<{ key: keyof ImportRow; header: string; aliases: string[]; required?: boolean; example: string }> = [
  { key: 'firstName', header: 'First name', aliases: ['firstname', 'first name', 'first', 'given name'], required: true, example: 'Asha' },
  { key: 'lastName', header: 'Last name', aliases: ['lastname', 'last name', 'last', 'surname', 'family name'], required: true, example: 'Rao' },
  { key: 'email', header: 'Email', aliases: ['email', 'work email', 'email address', 'e-mail'], required: true, example: 'asha.rao@yourcompany.com' },
  { key: 'joiningDate', header: 'Joining date', aliases: ['joining date', 'joiningdate', 'date of joining', 'doj', 'start date'], required: true, example: '2026-04-01' },
  { key: 'phone', header: 'Phone', aliases: ['phone', 'mobile', 'phone number'], example: '9876543210' },
  { key: 'employmentType', header: 'Employment type', aliases: ['employment type', 'type', 'employmenttype'], example: 'Full time' },
  { key: 'department', header: 'Department', aliases: ['department', 'dept', 'department code'], example: 'Engineering' },
  { key: 'designation', header: 'Job title', aliases: ['job title', 'title', 'designation', 'role title'], example: 'Software Engineer' },
  { key: 'location', header: 'Location', aliases: ['location', 'office', 'branch'], example: 'Bengaluru HQ' },
  { key: 'managerEmail', header: 'Manager email', aliases: ['manager email', 'manager', 'reporting manager', 'reporting manager email', 'manageremail'], example: 'lead@yourcompany.com' },
];

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, commas / newlines in quotes, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Header row → ImportRow objects; unknown columns are reported. */
export function rowsFromCsv(text: string): { rows: ImportRow[]; unknownColumns: string[]; missingColumns: string[] } {
  const [header = [], ...data] = parseCsv(text);
  const keys = header.map((h) => {
    const n = h.trim().toLowerCase().replace(/[_*]/g, ' ').replace(/\s+/g, ' ');
    return IMPORT_COLUMNS.find((c) => c.aliases.includes(n) || c.header.toLowerCase() === n)?.key ?? null;
  });
  const rows = data.map((cells) => {
    const r: ImportRow = {};
    keys.forEach((k, i) => {
      if (k && cells[i]?.trim()) r[k] = cells[i]!.trim();
    });
    return r;
  });
  return {
    rows,
    unknownColumns: header.filter((_, i) => !keys[i]).map((h) => h.trim()).filter(Boolean),
    missingColumns: IMPORT_COLUMNS.filter((c) => c.required && !keys.includes(c.key)).map((c) => c.header),
  };
}

export function templateCsv(): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [IMPORT_COLUMNS.map((c) => esc(c.header)).join(','), IMPORT_COLUMNS.map((c) => esc(c.example)).join(',')].join('\r\n') + '\r\n';
}

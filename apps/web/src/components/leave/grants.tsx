'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Ban, CalendarRange, Check, FileText, Gift, History, Inbox, Paperclip, Pencil, Plus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, FormError, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { DateInput, Select } from '@/components/ui/pickers';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { PersonSearch } from '@/components/people/person-search';
import { usePeopleByIds } from '@/lib/company/org';
import {
  days,
  monthsLater,
  openGrantDocument,
  useAskForGrant,
  useCancelGrantRequest,
  useCreateGrant,
  useDecideGrantRequest,
  useGrantRequests,
  useLeaveGrants,
  useRevokeGrant,
  useUpdateGrant,
  type AskableLeave,
  type LeaveGrant,
  type LeaveGrantRequest,
  type LeaveTypeAdmin,
} from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

// ============================================================
// Leave grants: HR gives an "only when granted" type to people
// for a window (it can cross the year); people who may ask for
// one send dates + a document; HR approves into a grant.
// ============================================================

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (k: string) => new Date(`${k}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const windowLabel = (from: string, to: string) => `${fmt(from)} – ${fmt(to)}`;

const open = (kind: 'grants' | 'grant-requests', id: string) => openGrantDocument(kind, id).catch((err) => toast.error(getApiErrorMessage(err, 'Could not open the document')));

/** Choose one supporting document (PDF, image or .docx). */
function FilePick({ file, onFile, required }: { file: File | null; onFile: (f: File | null) => void; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" className="sr-only" tabIndex={-1} onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <Button size="sm" variant="secondary" onClick={() => input.current?.click()}><Paperclip /> {file ? 'Change file' : 'Attach a document'}</Button>
      {file ? (
        <span className="flex items-center gap-1 text-xs">
          <FileText className="h-3.5 w-3.5" /> {file.name}
          <button type="button" aria-label="Remove file" className="rounded p-0.5 hover:bg-subtle" onClick={() => onFile(null)}><X className="h-3 w-3" /></button>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{required ? 'Required' : 'Optional'} · PDF, JPG, PNG or Word · up to 10 MB</span>
      )}
    </div>
  );
}

// ─── HR: grant leave ─────────────────────────────────────────

/** HR grants a grant-only type to one or more people. */
export function GrantDialog({ open: isOpen, onClose, types, employeeId, leaveTypeId }: { open: boolean; onClose: () => void; types: Array<Pick<LeaveTypeAdmin, 'id' | 'name' | 'annualQuota' | 'grantNeedsDocument' | 'availability' | 'isActive'>>; employeeId?: string; leaveTypeId?: string }) {
  const grantable = types.filter((t) => t.availability === 'GRANT_ONLY' && t.isActive);
  const create = useCreateGrant();
  const [typeId, setTypeId] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [d, setD] = useState(0);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(monthsLater(today(), 12));
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = usePeopleByIds(people);
  const type = grantable.find((t) => t.id === typeId);

  useEffect(() => {
    if (!isOpen) return;
    const t = grantable.find((x) => x.id === leaveTypeId) ?? grantable[0];
    setTypeId(t?.id ?? '');
    setD(t?.annualQuota ?? 0);
    setPeople(employeeId ? [employeeId] : []);
    setFrom(today());
    setTo(monthsLater(today(), 12));
    setReason('');
    setFile(null);
    setError(null);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!people.length) return setError('Choose at least one person');
    if (type?.grantNeedsDocument && !file) return setError(`${type.name} needs a supporting document`);
    try {
      const r = await create.mutateAsync({ employeeIds: people, leaveTypeId: typeId, days: Number(d), validFrom: from, validTo: to, reason, file });
      toast.success(`${type?.name ?? 'Leave'} granted to ${r.length === 1 ? `${r[0]!.employee.firstName}` : `${r.length} people`}`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not grant'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={create.isPending}
      icon={<Gift />}
      title="Grant leave"
      description="The person can apply for these days between the two dates. Days not used by the end date lapse."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button type="submit" form="grant-form" loading={create.isPending} disabled={!grantable.length}>Grant</Button>
        </>
      }
    >
      {!grantable.length ? (
        <EmptyState icon={<Gift />} title="No leave is given by grant yet" description="Edit a leave type and choose “Only when granted” under Who can use it." />
      ) : (
        <form id="grant-form" onSubmit={submit} className="space-y-4">
          <FormError>{error}</FormError>
          <Field label="Leave type" htmlFor="g-type" required>
            <Select id="g-type" className={inputClass} value={typeId} onChange={(e) => { setTypeId(e.target.value); setD(grantable.find((t) => t.id === e.target.value)?.annualQuota ?? 0); }}>
              {grantable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label={people.length > 1 ? `People (${people.length})` : 'Person'} htmlFor="g-people" required>
            {people.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {people.map((id) => {
                  const p = chosen.data?.find((x) => x.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-subtle py-0.5 pl-0.5 pr-1 text-xs font-medium">
                      {p && <PersonAvatar person={p} size="xs" />} {p ? `${p.firstName} ${p.lastName}` : '…'}
                      <button type="button" aria-label="Remove" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setPeople(people.filter((x) => x !== id))}><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
            )}
            <PersonSearch id="g-people" overlay value="" hide={people} onChange={(id) => id && setPeople([...people, id])} placeholder={people.length ? 'Add someone else…' : 'Choose a person'} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Days" htmlFor="g-days" required><Input id="g-days" type="number" min={0.5} max={366} step={0.5} value={d} onChange={(e) => setD(Number(e.target.value))} required /></Field>
            <Field label="From" htmlFor="g-from" required><DateInput id="g-from" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(monthsLater(e.target.value, 12)); }} required /></Field>
            <Field label="Use by" htmlFor="g-to" required><DateInput id="g-to" value={to} min={from} onChange={(e) => setTo(e.target.value)} required /></Field>
          </div>
          <Field label="Reason" htmlFor="g-reason" required hint="Kept with the grant; the person sees it">
            <Textarea id="g-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} placeholder="e.g. Certificate of expected confinement received" />
          </Field>
          <Field label="Supporting document" htmlFor="g-file"><FilePick file={file} onFile={setFile} required={type?.grantNeedsDocument} /></Field>
        </form>
      )}
    </Modal>
  );
}

/** Extend / shorten / change days — with a reason kept in the history. */
export function ChangeGrantDialog({ grant, onClose }: { grant: LeaveGrant | null; onClose: () => void }) {
  const update = useUpdateGrant();
  const [d, setD] = useState(0);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!grant) return;
    setD(grant.days);
    setTo(grant.validTo);
    setNote('');
    setError(null);
  }, [grant]);
  if (!grant) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({ id: grant.id, ...(d !== grant.days && { days: Number(d) }), ...(to !== grant.validTo && { validTo: to }), note });
      toast.success('Grant updated');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the grant'));
    }
  };
  const unchanged = d === grant.days && to === grant.validTo;
  return (
    <Modal
      open
      onClose={onClose}
      busy={update.isPending}
      icon={<Pencil />}
      tone="edit"
      title={`Change ${grant.employee.firstName}’s ${grant.leaveType.name.toLowerCase()}`}
      description={`${days(grant.taken)} already taken — the grant can’t go below that.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button type="submit" form="grant-change" loading={update.isPending} disabled={unchanged}>Save</Button>
        </>
      }
    >
      <form id="grant-change" onSubmit={submit} className="space-y-4">
        <FormError>{error}</FormError>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Days" htmlFor="gc-days"><Input id="gc-days" type="number" min={Math.max(0.5, grant.taken)} max={366} step={0.5} value={d} onChange={(e) => setD(Number(e.target.value))} /></Field>
          <Field label="Use by" htmlFor="gc-to" hint={to > grant.validTo ? 'Extends the grant' : to < grant.validTo ? 'Shortens the grant' : undefined}>
            <DateInput id="gc-to" value={to} min={grant.validFrom} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="Why" htmlFor="gc-note" required><Textarea id="gc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} maxLength={500} placeholder="e.g. Delivery date moved — extended by a month" /></Field>
      </form>
    </Modal>
  );
}

function RevokeGrantDialog({ grant, onClose }: { grant: LeaveGrant | null; onClose: () => void }) {
  const revoke = useRevokeGrant();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setNote(''); setError(null); }, [grant]);
  if (!grant) return null;
  return (
    <Modal
      open
      onClose={onClose}
      busy={revoke.isPending}
      icon={<Ban />}
      tone="danger"
      title={`Withdraw ${grant.employee.firstName}’s grant?`}
      description="Only possible while no leave has been applied on it. The person is told."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={revoke.isPending}>Keep it</Button>
          <Button
            variant="danger"
            loading={revoke.isPending}
            disabled={note.trim().length < 3}
            onClick={async () => {
              try {
                await revoke.mutateAsync({ id: grant.id, note });
                toast.success('Grant withdrawn');
                onClose();
              } catch (err) {
                setError(getApiErrorMessage(err, 'Could not withdraw the grant'));
              }
            }}
          >
            Withdraw
          </Button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <Field label="Why" htmlFor="gr-note" required><Textarea id="gr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Granted by mistake" /></Field>
    </Modal>
  );
}

/** HR answers someone's request: approve into a grant (days and window can change) or decline. */
function DecideRequestDialog({ request, onClose }: { request: LeaveGrantRequest | null; onClose: () => void }) {
  const decide = useDecideGrantRequest();
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [d, setD] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!request) return;
    setMode('approve');
    setD(request.leaveType.annualQuota);
    // A window of a year from the expected start gives room for dates to move
    setFrom(request.fromDate);
    setTo(monthsLater(request.fromDate, 12) > request.toDate ? monthsLater(request.fromDate, 12) : request.toDate);
    setNote('');
    setError(null);
  }, [request]);
  if (!request) return null;
  const submit = async () => {
    setError(null);
    try {
      if (mode === 'approve') await decide.mutateAsync({ id: request.id, approve: true, days: Number(d), validFrom: from, validTo: to, note });
      else await decide.mutateAsync({ id: request.id, approve: false, note });
      toast.success(mode === 'approve' ? `${request.leaveType.name} granted to ${request.employee.firstName}` : 'Request declined');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={decide.isPending}
      icon={<Inbox />}
      title={`${request.employee.firstName} ${request.employee.lastName} asks for ${request.leaveType.name.toLowerCase()}`}
      description={`Expected ${windowLabel(request.fromDate, request.toDate)}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={decide.isPending}>Cancel</Button>
          <Button variant={mode === 'approve' ? 'success' : 'danger'} loading={decide.isPending} onClick={() => void submit()} disabled={mode === 'reject' && note.trim().length < 3}>
            {mode === 'approve' ? <><Check /> Grant</> : <><X /> Decline</>}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError>{error}</FormError>
        <div className="rounded-xl bg-subtle/80 px-4 py-3 text-sm">
          <p className="whitespace-pre-wrap">{request.note}</p>
          {request.document ? (
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => void open('grant-requests', request.id)}><FileText /> {request.document.name}</Button>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No document attached.</p>
          )}
        </div>
        <div className="flex gap-1.5" role="radiogroup">
          {(['approve', 'reject'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', mode === m ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
              {m === 'approve' ? 'Grant it' : 'Decline'}
            </button>
          ))}
        </div>
        {mode === 'approve' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Days" htmlFor="dr-days"><Input id="dr-days" type="number" min={0.5} max={366} step={0.5} value={d} onChange={(e) => setD(Number(e.target.value))} /></Field>
            <Field label="From" htmlFor="dr-from"><DateInput id="dr-from" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Use by" htmlFor="dr-to"><DateInput id="dr-to" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        )}
        <Field label={mode === 'approve' ? 'Note (optional)' : 'Why'} htmlFor="dr-note" required={mode === 'reject'}>
          <Textarea id="dr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={mode === 'approve' ? 'e.g. Certificate checked' : 'e.g. Please attach the doctor’s certificate'} />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Employee: ask HR ───────────────────────────────────────

export function AskGrantDialog({ item, onClose }: { item: AskableLeave | null; onClose: () => void }) {
  const ask = useAskForGrant();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!item) return;
    setFrom('');
    setTo('');
    setNote('');
    setFile(null);
    setError(null);
  }, [item]);
  if (!item) return null;
  const t = item.leaveType;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!from || !to) return setError('Pick the expected dates');
    if (t.grantNeedsDocument && !file) return setError('Attach a supporting document');
    try {
      await ask.mutateAsync({ leaveTypeId: t.id, fromDate: from, toDate: to, note, file });
      toast.success('Sent to HR — you’ll get a notification when they answer');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={ask.isPending}
      icon={<Send />}
      title={`Ask HR for ${t.name.toLowerCase()}`}
      description="HR checks your request and grants the days. Then you apply for the leave as usual."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={ask.isPending}>Cancel</Button>
          <Button type="submit" form="ask-grant" loading={ask.isPending}><Send /> Send to HR</Button>
        </>
      }
    >
      <form id="ask-grant" onSubmit={submit} className="space-y-4">
        <FormError>{error}</FormError>
        {t.description && <p className="rounded-xl bg-subtle/80 px-4 py-3 text-sm">{t.description}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Expected from" htmlFor="ag-from" required><DateInput id="ag-from" value={from} onChange={(e) => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); }} required /></Field>
          <Field label="Expected until" htmlFor="ag-to" required><DateInput id="ag-to" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} required /></Field>
        </div>
        <Field label="Note for HR" htmlFor="ag-note" required><Textarea id="ag-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} maxLength={1000} placeholder="e.g. Due date 10 August; planning to start a week before." /></Field>
        <Field label="Supporting document" htmlFor="ag-file" required={t.grantNeedsDocument} hint="Only HR sees it"><FilePick file={file} onFile={setFile} required={t.grantNeedsDocument} /></Field>
      </form>
    </Modal>
  );
}

/** Balances page: grant-only types the person may ask for, and their waiting requests. */
export function AskableCards({ items }: { items: AskableLeave[] }) {
  const [asking, setAsking] = useState<AskableLeave | null>(null);
  const cancel = useCancelGrantRequest();
  if (!items.length) return null;
  return (
    <>
      {items.map((a) => (
        <div key={a.leaveType.id} className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-surface p-4" style={{ borderTopColor: a.leaveType.color }}>
          <div className="flex items-center gap-2">
            <span className="rounded-lg px-2 py-1 font-mono text-xs font-black" style={{ background: `color-mix(in srgb, ${a.leaveType.color} 15%, transparent)`, color: a.leaveType.color }}>{a.leaveType.code}</span>
            <p className="flex-1 truncate font-semibold">{a.leaveType.name}</p>
          </div>
          {a.request ? (
            <>
              <p className="text-xs text-muted-foreground">Asked {fmt(a.request.createdAt.slice(0, 10))} for {windowLabel(a.request.fromDate, a.request.toDate)}</p>
              <div className="mt-auto flex items-center gap-2">
                <Badge tone="warning" dot>Waiting for HR</Badge>
                <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate(a.request!.id, { onSuccess: () => toast.success('Request taken back'), onError: (err) => toast.error(getApiErrorMessage(err)) })}>Take back</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Given by HR when you need it{a.leaveType.grantNeedsDocument ? ' — with a supporting document' : ''}.</p>
              <Button size="sm" variant="soft" className="mt-auto self-start" onClick={() => setAsking(a)}><Send /> Ask HR</Button>
            </>
          )}
        </div>
      ))}
      <AskGrantDialog item={asking} onClose={() => setAsking(null)} />
    </>
  );
}

// ─── HR: the Grants tab ─────────────────────────────────────

export function GrantsPanel({ types }: { types: LeaveTypeAdmin[] }) {
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'REVOKED' | ''>('ACTIVE');
  const grants = useLeaveGrants({ leaveTypeId: typeId || undefined, status: status || undefined });
  const requests = useGrantRequests({ view: 'review' });
  const [granting, setGranting] = useState(false);
  const [changing, setChanging] = useState<LeaveGrant | null>(null);
  const [revoking, setRevoking] = useState<LeaveGrant | null>(null);
  const [deciding, setDeciding] = useState<LeaveGrantRequest | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const grantTypes = useMemo(() => types.filter((t) => t.availability === 'GRANT_ONLY'), [types]);

  return (
    <div className="space-y-5">
      {(requests.data?.length ?? 0) > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4 text-muted-foreground" /> Waiting for you <Badge tone="warning">{requests.data!.length}</Badge></h2>
          <ul className="divide-y divide-border">
            {requests.data!.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <PersonAvatar person={r.employee} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.employee.firstName} {r.employee.lastName} · <span style={{ color: r.leaveType.color }}>{r.leaveType.name}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{windowLabel(r.fromDate, r.toDate)} · {r.note}</p>
                </div>
                {r.document && <Button size="sm" variant="ghost" onClick={() => void open('grant-requests', r.id)}><FileText /> Document</Button>}
                <Button size="sm" onClick={() => setDeciding(r)}>Review</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="flex flex-1 items-center gap-2 text-sm font-semibold"><Gift className="h-4 w-4 text-muted-foreground" /> Grants</h2>
          <Select className={cn(inputClass, 'w-44')} aria-label="Leave type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">All grant types</option>
            {grantTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select className={cn(inputClass, 'w-36')} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="ACTIVE">Active</option>
            <option value="REVOKED">Withdrawn</option>
            <option value="">All</option>
          </Select>
          <Button size="sm" onClick={() => setGranting(true)}><Plus /> Grant leave</Button>
        </div>
        {grants.isLoadingError ? (
          <ErrorState message={getApiErrorMessage(grants.error)} onRetry={() => grants.refetch()} />
        ) : !grants.data ? (
          <Skeleton className="h-32 w-full" />
        ) : !grants.data.length ? (
          <EmptyState
            icon={<Gift />}
            title={grantTypes.length ? 'No grants yet' : 'No leave is given by grant yet'}
            description={grantTypes.length ? 'Grant leave to someone, or approve a request when it comes in.' : 'Edit a leave type (e.g. Maternity) and choose “Only when granted” under Who can use it.'}
          />
        ) : (
          <ul className="divide-y divide-border">
            {grants.data.map((g) => (
              <li key={g.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <PersonAvatar person={g.employee} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{g.employee.firstName} {g.employee.lastName} · <span style={{ color: g.leaveType.color }}>{g.leaveType.name}</span></p>
                    <p className="text-xs text-muted-foreground"><CalendarRange className="mr-1 inline h-3 w-3" />{windowLabel(g.validFrom, g.validTo)} · {days(g.days)} · {g.taken} taken · <b className="text-foreground">{g.left} left</b></p>
                  </div>
                  {g.status === 'REVOKED' ? <Badge>Withdrawn</Badge> : g.ended ? <Badge>Ended</Badge> : <Badge tone="success" dot>Active</Badge>}
                  {g.document && <Button size="icon-sm" variant="ghost" aria-label="Open document" onClick={() => void open('grants', g.id)}><FileText /></Button>}
                  <Button size="icon-sm" variant="ghost" aria-label="History" aria-expanded={historyOf === g.id} onClick={() => setHistoryOf(historyOf === g.id ? null : g.id)}><History /></Button>
                  {g.status === 'ACTIVE' && <Button size="sm" variant="secondary" onClick={() => setChanging(g)}><Pencil /> Change</Button>}
                  {g.status === 'ACTIVE' && g.taken === 0 && <Button size="sm" variant="ghost" onClick={() => setRevoking(g)}>Withdraw</Button>}
                </div>
                {historyOf === g.id && (
                  <ol className="ml-11 mt-2 space-y-1 border-l border-border pl-3 text-xs">
                    {g.history.map((h) => (
                      <li key={h.id}>
                        <b>{h.kind === 'CREATED' ? 'Granted' : h.kind === 'REVOKED' ? 'Withdrawn' : 'Changed'}</b>
                        {h.days !== null && h.kind !== 'REVOKED' && ` · ${days(h.days)}`}
                        {h.validTo && h.kind !== 'REVOKED' && ` · use by ${fmt(h.validTo)}`}
                        {h.note && <span className="text-muted-foreground"> — {h.note}</span>}
                        <span className="text-muted-foreground"> · {h.by ? `${h.by.firstName} ${h.by.lastName}, ` : ''}{fmt(h.createdAt.slice(0, 10))}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <GrantDialog open={granting} onClose={() => setGranting(false)} types={types} leaveTypeId={typeId || undefined} />
      <ChangeGrantDialog grant={changing} onClose={() => setChanging(null)} />
      <RevokeGrantDialog grant={revoking} onClose={() => setRevoking(null)} />
      <DecideRequestDialog request={deciding} onClose={() => setDeciding(null)} />
    </div>
  );
}

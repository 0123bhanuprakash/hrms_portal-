'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Info, Pause, Send, UserMinus, UserPlus, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, FormError } from '@/components/ui/field';
import { DateInput, PersonSelect } from '@/components/ui/pickers';
import { usePeoplePicker } from '@/lib/company/org';
import { useRaiseRelease, useRaiseRequest, useSkillSuggestions, type RaiseInput } from '@/lib/company/resources';
import { getApiErrorMessage } from '@/lib/errors';
import { TagInput } from './parts';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const plusDays = (k: string, n: number) => {
  const d = new Date(`${k}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface RequestProject {
  id: string;
  name: string;
  pm?: { firstName: string; lastName: string } | null;
  dd?: { firstName: string; lastName: string } | null;
  techStack?: string[];
}

/** "Request a person": role, skills, %, dates, why, and optionally who. */
export function RequestPersonDialog({ project, prefill, onClose, onDone }: { project: RequestProject; prefill?: Partial<RaiseInput>; onClose: () => void; onDone?: (id: string) => void }) {
  const raise = useRaiseRequest();
  const people = usePeoplePicker();
  const suggestions = useSkillSuggestions();
  const [f, setF] = useState<RaiseInput>({
    projectId: project.id,
    title: prefill?.title ?? '',
    skills: prefill?.skills ?? [],
    allocation: prefill?.allocation ?? 100,
    fromDate: prefill?.fromDate && prefill.fromDate >= todayKey() ? prefill.fromDate : plusDays(todayKey(), 7),
    untilDate: prefill?.untilDate ?? null,
    reason: prefill?.reason ?? '',
    preferredEmployeeId: prefill?.preferredEmployeeId ?? null,
    previousRequestId: prefill?.previousRequestId ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RaiseInput>(k: K, v: RaiseInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const options = useMemo(() => (people.data?.employees ?? []).map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, avatarUrl: e.avatarUrl, sub: e.designation?.name ?? null })), [people.data]);
  const send = async () => {
    setError(null);
    if (f.title.trim().length < 2) return setError('Say what role you need');
    if (f.reason.trim().length < 5) return setError('Say why you need them (a sentence is enough)');
    try {
      const r = await raise.mutateAsync({ ...f, title: f.title.trim(), reason: f.reason.trim() });
      toast.success(`Request sent to ${r.step === 'PM' ? (project.pm ? `${project.pm.firstName} (PM)` : 'the PM') : r.step === 'DD' ? 'the Delivery Director' : 'the PMO'}`);
      onDone?.(r.id);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the request'));
    }
  };
  const chain = [project.pm && `${project.pm.firstName} (PM)`, project.dd && `${project.dd.firstName} (Delivery Director)`, 'the PMO'].filter(Boolean).join(' → ');
  return (
    <Modal
      open
      onClose={onClose}
      busy={raise.isPending}
      icon={<UserPlus />}
      title={`Request a person for ${project.name}`}
      description="Tell your PM what you need. Anyone on the way can fill it."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={raise.isPending}>Cancel</Button>
          <Button onClick={() => void send()} loading={raise.isPending}><Send /> Send request</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError>{error}</FormError>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Role needed" htmlFor="rr-title" required>
            <Input id="rr-title" value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Senior React developer" autoFocus />
          </Field>
          <Field label="Allocation" htmlFor="rr-alloc" required hint="% of their week">
            <div className="relative">
              <Input id="rr-alloc" type="number" min={5} max={100} step={5} value={f.allocation} onChange={(e) => set('allocation', Math.max(5, Math.min(100, Number(e.target.value) || 0)))} className="pr-7" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </Field>
        </div>
        <Field label="Skills" htmlFor="rr-skills" hint={project.techStack?.length ? `Used to find the best match, with the project’s tech stack (${project.techStack.join(', ')}).` : 'Used to find the best match.'}>
          <TagInput id="rr-skills" value={f.skills} onChange={(v) => set('skills', v)} suggestions={suggestions.data ?? []} placeholder="Type a skill and press Enter" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="rr-from" required>
            <DateInput id="rr-from" value={f.fromDate} min={todayKey()} onChange={(e) => set('fromDate', e.target.value)} required />
          </Field>
          <Field label="Until (optional)" htmlFor="rr-until" hint="Blank = until the project ends">
            <DateInput id="rr-until" value={f.untilDate ?? ''} min={f.fromDate} onChange={(e) => set('untilDate', e.target.value || null)} />
          </Field>
        </div>
        <Field label="Why do you need this person?" htmlFor="rr-reason" required hint="Your PM, Delivery Director and the PMO read this.">
          <Textarea id="rr-reason" value={f.reason} maxLength={1000} rows={3} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. Checkout revamp UAT is on 15 Nov — we need one more front-end developer." />
        </Field>
        <Field label="Preferred person (optional)" htmlFor="rr-pref" hint="They aren’t told they were asked for — only if they’re assigned.">
          <PersonSelect id="rr-pref" people={options} value={f.preferredEmployeeId ?? ''} onChange={(v) => set('preferredEmployeeId', v || null)} emptyLabel="No preference" />
        </Field>
        <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Goes to {chain}. Someone who isn’t on your PM’s or Delivery Director’s projects can only be assigned by the PMO. You’ll see every step under Work → Resource requests.
          </span>
        </p>
      </div>
    </Modal>
  );
}

/** "Release someone": why, last day, hand-over. Goes to the PM / Delivery Director. */
export function ReleaseDialog({ member, project, onClose }: { member: { id: string; employee: { firstName: string; lastName: string }; endDate?: string | null }; project: { name: string }; onClose: () => void }) {
  const release = useRaiseRelease();
  const [reason, setReason] = useState('');
  const [lastDate, setLastDate] = useState(plusDays(todayKey(), 14));
  const [handover, setHandover] = useState('');
  const [error, setError] = useState<string | null>(null);
  const REASONS = ['Work is done', 'Scope reduced', 'Skills no longer needed', 'Budget cut'];
  const send = async () => {
    setError(null);
    if (reason.trim().length < 5) return setError('Say why (a sentence is enough)');
    try {
      await release.mutateAsync({ memberId: member.id, reason: reason.trim(), lastDate, handover: handover.trim() || null });
      toast.success(`Sent to your PM — ${member.employee.firstName} isn’t told until they decide`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send it'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={release.isPending}
      icon={<UserMinus />}
      title={`Release ${member.employee.firstName} from ${project.name}?`}
      description="Your PM or Delivery Director decides: the PMO pool, another of their projects, or they stay."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={release.isPending}>Cancel</Button>
          <Button onClick={() => void send()} loading={release.isPending}><Send /> Send to PM</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError>{error}</FormError>
        <Field label="Why don’t you need them any more?" htmlFor="rl-reason" required>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/40 hover:bg-subtle">{r}</button>
            ))}
          </div>
          <Textarea id="rl-reason" value={reason} rows={3} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Last day on the project" htmlFor="rl-last" required>
          <DateInput id="rl-last" value={lastDate} min={todayKey()} max={member.endDate ?? undefined} onChange={(e) => setLastDate(e.target.value)} required />
        </Field>
        <Field label="Hand-over notes (optional)" htmlFor="rl-hand">
          <Textarea id="rl-hand" value={handover} rows={2} maxLength={1000} onChange={(e) => setHandover(e.target.value)} placeholder="What they’re finishing, who takes over…" />
        </Field>
      </div>
    </Modal>
  );
}

/** A reason is required (hold, reject, keep); hold can also set a "remind me on" day. */
export function ReasonDialog({
  kind,
  onClose,
  onSubmit,
  busy,
}: {
  kind: 'hold' | 'reject' | 'keep';
  onClose: () => void;
  onSubmit: (reason: string, remindAt: string | null) => Promise<void>;
  busy: boolean;
}) {
  const [reason, setReason] = useState('');
  const [remind, setRemind] = useState('');
  const [error, setError] = useState<string | null>(null);
  const meta = {
    hold: { title: 'Put on hold', text: 'The Lead is told why. It waits until you unhold it.', button: 'Hold', icon: <Pause />, quick: ['Waiting for client budget', 'Waiting for the project start date', 'Checking with the team first'] },
    reject: { title: 'Reject this request', text: 'It closes and goes back to the Lead with your reason. They can raise it again.', button: 'Reject', icon: <X />, quick: ['Covered by the existing team', 'No budget for this', 'Not needed for this phase'] },
    keep: { title: 'Keep them on the project', text: 'The Lead is told why. The person isn’t told anything.', button: 'Keep them', icon: <UserPlus />, quick: ['Still needed for the next release', 'No replacement yet'] },
  }[kind];
  const go = async () => {
    if (reason.trim().length < 3) return setError('A reason is required');
    setError(null);
    try {
      await onSubmit(reason.trim(), remind || null);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={meta.icon}
      tone={kind === 'reject' ? 'danger' : undefined}
      title={meta.title}
      description={meta.text}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={kind === 'reject' ? 'danger' : 'primary'} onClick={() => void go()} loading={busy}>{meta.button}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError>{error}</FormError>
        <div className="flex flex-wrap gap-1.5">
          {meta.quick.map((q) => (
            <button key={q} type="button" onClick={() => setReason(q)} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/40 hover:bg-subtle">{q}</button>
          ))}
        </div>
        <Field label="Reason" htmlFor="rs-reason" required>
          <Textarea id="rs-reason" value={reason} rows={3} maxLength={1000} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
        {kind === 'hold' && (
          <Field label="Remind me on (optional)" htmlFor="rs-remind" hint="Otherwise you get a nudge after 7 days on hold.">
            <DateInput id="rs-remind" value={remind} min={plusDays(todayKey(), 1)} onChange={(e) => setRemind(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

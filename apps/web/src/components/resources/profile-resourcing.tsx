'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRightLeft, Check, History, Pencil, Plus, RotateCcw, Sparkles, UserMinus, UserPlus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { HISTORY_TEXT, useApproveExperience, useAssignmentHistory, useRejectExperience, useSetSkills, useSkillSuggestions, type ExperienceState, type HistoryEntry } from '@/lib/company/resources';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SkillPickerDialog } from './skill-picker';
import { RequestPersonDialog } from './dialogs';

/**
 * Profile → Projects tab: skills (the person keeps them; HR can too) and the
 * assignment history (requested, assigned, reassigned, released — who and when).
 */
export function ProfileResourcing({ employeeId, isSelf = false, canEditSkills }: { employeeId: string; isSelf?: boolean; canEditSkills: boolean }) {
  const q = useAssignmentHistory(employeeId);
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!q.data) return null; // not theirs to see
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <SkillsCard employeeId={employeeId} skills={q.data.skills} experience={q.data.experience} canEdit={canEditSkills} isSelf={isSelf} name={q.data.person?.firstName ?? 'They'} />
      <HistoryCard entries={q.data.data} requestBackFrom={q.data.requestBackFrom} employeeId={employeeId} person={q.data.person} />
    </div>
  );
}

/** "6.5 yrs" / "8 mo" */
const yrs = (months: number) => (months < 12 ? `${Math.max(0, Math.round(months))} mo` : `${Math.round(months / 1.2) / 10} yrs`);
const monthsSince = (key: string) => Math.max(0, (Date.now() - new Date(`${key}T00:00:00Z`).getTime()) / (30.4375 * 86400_000));

function SkillsCard({ employeeId, skills, experience, canEdit, isSelf, name }: { employeeId: string; skills: string[]; experience: ExperienceState | null; canEdit: boolean; isSelf: boolean; name: string }) {
  const save = useSetSkills();
  const suggestions = useSkillSuggestions(canEdit);
  const [picking, setPicking] = useState(false);
  const [editingExp, setEditingExp] = useState(false);
  const prior = experience?.priorMonths ?? null;
  const [priorYears, setPriorYears] = useState('');
  const here = experience ? monthsSince(experience.joiningDate) : 0;
  const saveSkills = (next: string[], done: string, after?: () => void) =>
    save.mutate({ employeeId, skills: next }, { onSuccess: () => { toast.success(done); after?.(); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')) });
  const saveExperience = () => {
    const y = priorYears.trim() === '' ? null : Number(priorYears);
    if (y !== null && (!Number.isFinite(y) || y < 0 || y > 50)) {
      toast.error('Experience before joining: 0 to 50 years');
      return;
    }
    save.mutate(
      { employeeId, skills, priorExperienceMonths: y === null ? null : Math.round(y * 12) },
      {
        onSuccess: () => {
          // The person's own value waits for HR; HR's counts at once
          toast.success(isSelf && (y === null ? null : Math.round(y * 12)) !== prior ? (y === null ? 'Taken back' : 'Sent to HR to verify — it counts once they approve') : 'Experience saved');
          setEditingExp(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')),
      },
    );
  };
  return (
    <Card>
      <CardHeader icon={<Sparkles />} title="Skills & experience" description="Matched against resource requests and project tech stacks" action={canEdit && <Button size="sm" variant="ghost" onClick={() => setPicking(true)}><Plus /> Add skills</Button>} />
      <div className="space-y-3 px-5 pb-5">
        {skills.length ? (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((sk) => (
              <Badge key={sk} tone="primary" className={cn(canEdit && 'gap-1 pr-1')}>
                {sk}
                {canEdit && (
                  <button type="button" aria-label={`Remove ${sk}`} disabled={save.isPending} onClick={() => saveSkills(skills.filter((x) => x !== sk), `${sk} removed`)} className="rounded-full p-0.5 opacity-60 hover:bg-primary/10 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No skills listed yet.{canEdit ? ' Add them so the right projects find you.' : ''}</p>
        )}
        {experience && (
          editingExp ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Experience before joining</span>
              <span className="relative">
                <Input autoFocus type="number" min={0} max={50} step={0.5} value={priorYears} onChange={(e) => setPriorYears(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveExperience()} className="h-8 w-24 pr-9" aria-label="Years of experience before joining" placeholder="0" />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">yrs</span>
              </span>
              <span className="text-xs text-muted-foreground">+ {yrs(here)} here{isSelf ? ' · HR verifies it before it counts' : ''}</span>
              <Button size="sm" variant="secondary" onClick={() => setEditingExp(false)}>Cancel</Button>
              <Button size="sm" loading={save.isPending} onClick={saveExperience}><Check /> Save</Button>
            </div>
          ) : (
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span>
                <b>{yrs((prior ?? 0) + here)}</b> <span className="text-muted-foreground">experience{prior === null ? ' (time here only)' : ` · ${yrs(prior)} before joining + ${yrs(here)} here`}</span>
                {prior !== null && experience.verifiedAt && <Badge tone="success" className="ml-1.5 gap-1"><Check className="h-3 w-3" /> Verified by HR</Badge>}
              </span>
              {canEdit && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setPriorYears(prior === null ? '' : String(Math.round(prior / 1.2) / 10)); setEditingExp(true); }}>
                  <Pencil /> {prior === null && experience.pendingMonths === null ? 'Add experience before joining' : 'Edit'}
                </Button>
              )}
            </p>
          )
        )}
        {experience?.pendingMonths !== null && experience?.pendingMonths !== undefined && (
          <PendingExperience employeeId={employeeId} months={experience.pendingMonths} submittedAt={experience.submittedAt} isSelf={isSelf} canVerify={!isSelf && canEdit} name={name} onWithdraw={() => save.mutate({ employeeId, skills, priorExperienceMonths: null }, { onSuccess: () => toast.success('Taken back') })} />
        )}
      </div>
      {picking && (
        <SkillPickerDialog
          have={skills}
          suggestions={suggestions.data ?? []}
          saving={save.isPending}
          onClose={() => setPicking(false)}
          onAdd={(more) => saveSkills([...skills, ...more], `${more.length} skill${more.length === 1 ? '' : 's'} added`, () => setPicking(false))}
        />
      )}
    </Card>
  );
}

/** Experience the person entered that HR hasn't verified: they can take it back; HR approves or rejects (with a reason). */
function PendingExperience({ employeeId, months, submittedAt, isSelf, canVerify, name, onWithdraw }: { employeeId: string; months: number; submittedAt: string | null; isSelf: boolean; canVerify: boolean; name: string; onWithdraw: () => void }) {
  const approve = useApproveExperience();
  const reject = useRejectExperience();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const busy = approve.isPending || reject.isPending;
  const when = submittedAt ? ` · sent ${formatRelative(submittedAt)}` : '';
  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft/50 px-3 py-2.5 text-sm">
      <p>
        {isSelf ? <>Waiting for HR to verify: <b>{yrs(months)}</b> before joining</> : <><b>{name}</b> entered <b>{yrs(months)}</b> of experience before joining</>}
        <span className="text-xs text-muted-foreground">{when}{isSelf ? ' · it counts once approved' : ''}</span>
      </p>
      {isSelf && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onWithdraw}>Take it back</Button>}
      {canVerify && !rejecting && (
        <div className="flex gap-2">
          <Button size="sm" loading={approve.isPending} disabled={busy} onClick={() => approve.mutate(employeeId, { onSuccess: () => toast.success('Experience verified'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not verify')) })}><Check /> Approve</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setRejecting(true)}><X /> Reject</Button>
        </div>
      )}
      {canVerify && rejecting && (
        <div className="flex flex-wrap items-center gap-2">
          <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Why? e.g. Doesn’t match the resume" className="h-8 min-w-0 flex-1" aria-label="Reason" />
          <Button size="sm" variant="secondary" onClick={() => setRejecting(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" variant="danger" loading={reject.isPending} disabled={reason.trim().length < 3} onClick={() => reject.mutate({ employeeId, reason: reason.trim() }, { onSuccess: () => { toast.success(`${name} is told why`); setRejecting(false); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not reject')) })}>Reject</Button>
        </div>
      )}
    </div>
  );
}

const ICON: Record<string, React.ReactNode> = {
  assigned: <UserPlus />,
  reassigned: <ArrowRightLeft />,
  released: <UserMinus />,
  to_pool: <UserMinus />,
  removed: <UserMinus />,
  changed: <Pencil />,
};

function HistoryCard({ entries, requestBackFrom, employeeId, person }: { entries: HistoryEntry[]; requestBackFrom: string[]; employeeId: string; person: { firstName: string; lastName: string; designation: string | null } | null }) {
  const [back, setBack] = useState<{ id: string; name: string } | null>(null);
  const backProjects = requestBackFrom.map((id) => entries.find((e) => e.project?.id === id)?.project).filter((p): p is NonNullable<HistoryEntry['project']> => Boolean(p));
  return (
    <Card>
      <CardHeader icon={<History />} title="Assignment history" description="Who requested, approved, assigned, moved or released them — and when" />
      <div className="space-y-3 px-5 pb-5">
        {backProjects.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-soft/50 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">They’ve left <b>{p.name}</b>. Need them again?</span>
            <Button size="sm" onClick={() => setBack({ id: p.id, name: p.name })}><RotateCcw /> Request {person?.firstName ?? 'them'} back</Button>
          </div>
        ))}
        {!entries.length ? (
          <p className="text-sm text-muted-foreground">No project changes recorded yet.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-5">
            {entries.map((e) => (
              <li key={e.id} className="relative">
                <span className={cn('absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-surface [&_svg]:size-3', e.action === 'assigned' ? 'bg-success-soft text-success' : ['released', 'to_pool', 'removed'].includes(e.action) ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary')}>{ICON[e.action] ?? <Pencil />}</span>
                <p className="text-sm">
                  <b>{HISTORY_TEXT[e.action] ?? e.action}</b>
                  {e.project && <> · <Link href={`/app/projects/${e.project.id}`} className="font-medium hover:underline">{e.project.name}</Link></>}
                  {e.allocation !== null && e.action !== 'removed' && <span className="text-muted-foreground"> · {e.allocation}%</span>}
                </p>
                {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                <p className="text-2xs text-muted-foreground">
                  {formatDate(e.at)}{e.actor && ` · by ${e.actor.firstName} ${e.actor.lastName}`}
                  {e.requestId && <> · <Link href={`/app/resources/${e.requestId}`} className="text-primary hover:underline">see the request</Link></>}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
      {back && (
        <RequestPersonDialog
          project={{ id: back.id, name: back.name }}
          prefill={{ title: person?.designation ?? 'Same role as before', preferredEmployeeId: employeeId, reason: `We need ${person?.firstName ?? 'them'} back on ${back.name}` }}
          onClose={() => setBack(null)}
        />
      )}
    </Card>
  );
}

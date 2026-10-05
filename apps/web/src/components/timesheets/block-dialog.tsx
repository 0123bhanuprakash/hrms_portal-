'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, Clock3, Lock, Timer, Trash2, Undo2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Textarea } from '@/components/ui/field';
import { blockColor, GENERAL_COLOR } from '@/components/timesheets/week-calendar';
import {
  TS_STATUS,
  WORK_TYPES,
  clock,
  fmtHours,
  fromTimeInput,
  longDayLabel,
  parseDuration,
  toTimeInput,
  useDeleteBlock,
  useRecallTime,
  useSaveBlock,
  type Block,
  type Week,
} from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

export interface BlockDraft {
  block?: Block;
  date: string;
  startMin: number;
  endMin: number;
  projectId?: string | null;
  description?: string;
}

/** Log work: pick one of my projects (or General), say what I did, set the times. */
export function BlockDialog({ week, draft, onClose }: { week: Week; draft: BlockDraft | null; onClose: () => void }) {
  const editing = draft?.block;
  const readOnly = Boolean(editing && !editing.canEdit);
  const save = useSaveBlock();
  const del = useDeleteBlock();
  const recall = useRecallTime();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [workType, setWorkType] = useState<string | null>(null);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    const b = draft.block;
    setProjectId(b ? b.project?.id ?? null : draft.projectId !== undefined ? draft.projectId : week.projects[0]?.id ?? null);
    setDescription(b?.description ?? draft.description ?? '');
    setWorkType(b?.workType ?? null);
    setStart(toTimeInput(b?.startMin ?? draft.startMin));
    setEnd(toTimeInput(b?.endMin ?? draft.endMin));
    setDuration('');
    setError(null);
    // Only when a different block/draft opens — not when the week refetches after a save
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const date = draft?.block?.date ?? draft?.date ?? week.today;
  const projects = week.projects.filter((p) => p.from <= date && (!p.to || p.to >= date));
  const s = fromTimeInput(start);
  const e0 = fromTimeInput(end);
  const e = s != null && e0 != null ? (e0 <= s ? e0 + 1440 : e0) : null;
  const minutes = s != null && e != null ? e - s : 0;
  const project = projects.find((p) => p.id === projectId) ?? null;
  const billing = useMemo(() => {
    if (!project) return { tone: 'neutral' as const, text: 'Investment — not on a project' };
    if (project.billable) return { tone: 'success' as const, text: `Billable — ${project.name} is a client project` };
    if (project.type === 'CLIENT') return { tone: 'neutral' as const, text: `Not billed — you’re marked as not billed on ${project.name}` };
    return { tone: 'neutral' as const, text: `Investment — ${project.name} is a company project` };
  }, [project]);

  const setFromDuration = (v: string) => {
    setDuration(v);
    const d = parseDuration(v);
    if (d && s != null) setEnd(toTimeInput(s + d));
  };

  const submit = async (another: boolean) => {
    setError(null);
    if (s == null || e == null) return setError('Pick a start and end time');
    if (description.trim().length < 2) return setError('Say what you worked on');
    try {
      await save.mutateAsync({ id: editing?.id, date, startMin: s, endMin: e, projectId, description: description.trim(), workType });
      toast.success(editing ? 'Block updated' : `Logged ${fmtHours(minutes)}`);
      if (another) {
        setStart(toTimeInput(e));
        setEnd(toTimeInput(e + 60));
        setDescription('');
        setDuration('');
      } else onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save'));
    }
  };

  const remove = async () => {
    if (!editing) return;
    try {
      await del.mutateAsync(editing.id);
      toast.success('Block deleted');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete'));
    }
  };

  if (!draft) return null;
  if (readOnly && editing) return <BlockView b={editing} isOwn={week.isOwn} onClose={onClose} recall={recall} />;

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending || del.isPending}
      title={editing ? 'Edit block' : 'Log work'}
      description={longDayLabel(date)}
      icon={<Timer />}
      className="max-w-xl"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {editing && <Button variant="ghost" className="text-destructive" icon={<Trash2 />} onClick={() => void remove()} loading={del.isPending}>Delete</Button>}
          <span className="hidden flex-1 text-[11px] text-muted-foreground sm:block">{!editing && 'Ctrl + Enter to save'}</span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!editing && <Button variant="secondary" onClick={() => void submit(true)} disabled={save.isPending}>Save &amp; add next</Button>}
          <Button onClick={() => void submit(false)} loading={save.isPending}>Save</Button>
        </div>
      }
    >
      <div
        className="space-y-4"
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) void submit(false);
        }}
      >
        {editing?.status === 'REJECTED' && editing.decisionNote && (
          <div className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span><b>Sent back{editing.decidedBy ? ` by ${editing.decidedBy.firstName}` : ''}:</b> {editing.decisionNote}</span>
          </div>
        )}
        <Field label="Project">
          <div className="grid gap-1.5 rounded-xl border border-border p-1.5" role="radiogroup" aria-label="Project">
            {projects.map((p) => (
              <ProjectOption key={p.id} on={projectId === p.id} color={blockColor(p)} title={p.name} sub={`${p.role === 'TEAM_LEAD' ? 'Team lead' : p.role === 'MANAGER' ? 'Project manager' : 'Member'} · ${p.allocation}%${p.lead ? ` · lead ${p.lead}` : ''}`} onClick={() => setProjectId(p.id)} />
            ))}
            <ProjectOption on={projectId === null} color={GENERAL_COLOR} title="General" sub="Meetings, learning, admin — not on a project" onClick={() => setProjectId(null)} />
          </div>
        </Field>
        <Field label="What did you work on?" htmlFor="blk-desc" required>
          <Textarea id="blk-desc" rows={2} value={description} onChange={(ev) => setDescription(ev.target.value)} maxLength={500} placeholder="e.g. Invoice API — pagination and filters" autoFocus />
        </Field>
        <div className="grid grid-cols-[1fr_1fr_0.9fr] gap-2">
          <Field label="From" htmlFor="blk-from"><Input id="blk-from" type="time" step={300} value={start} onChange={(ev) => setStart(ev.target.value)} /></Field>
          <Field label="To" htmlFor="blk-to" hint={e != null && e > 1440 ? 'ends the next day' : undefined}><Input id="blk-to" type="time" step={300} value={end} onChange={(ev) => setEnd(ev.target.value)} /></Field>
          <Field label="Duration" htmlFor="blk-dur"><Input id="blk-dur" value={duration || (minutes > 0 ? fmtHours(minutes) : '')} onChange={(ev) => setFromDuration(ev.target.value)} placeholder="2h" /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Type:</span>
          {WORK_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setWorkType(workType === t ? null : t)} aria-pressed={workType === t} className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors', workType === t ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
              {t}
            </button>
          ))}
        </div>
        <p className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold', billing.tone === 'success' ? 'bg-success/10 text-success' : 'bg-subtle text-muted-foreground')}>
          {billing.tone === 'success' && <Check className="h-3.5 w-3.5" />}
          {billing.text}
          <span className="ml-auto font-normal">set by the PMO</span>
        </p>
        {error && <p role="alert" className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      </div>
    </Modal>
  );
}

function ProjectOption({ on, color, title, sub, onClick }: { on: boolean; color: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors', on ? 'bg-primary-soft' : 'hover:bg-subtle')}>
      <span className="h-6 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
      {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

/** A sent / approved block: details, who it's with, and "take back" while it waits. */
function BlockView({ b, isOwn, onClose, recall }: { b: Block; isOwn: boolean; onClose: () => void; recall: ReturnType<typeof useRecallTime> }) {
  const c = blockColor(b.project);
  const st = TS_STATUS[b.status];
  return (
    <Modal
      open
      onClose={onClose}
      title={b.project?.name ?? 'General'}
      description={`${longDayLabel(b.date)}${b.startMin != null ? ` · ${clock(b.startMin)} – ${clock(b.endMin!)}` : ''} · ${fmtHours(b.minutes)}`}
      icon={b.status === 'APPROVED' ? <Lock /> : <Clock3 />}
      footer={
        <div className="flex w-full items-center gap-2">
          {isOwn && b.status === 'SUBMITTED' && (
            <Button
              variant="secondary"
              icon={<Undo2 />}
              loading={recall.isPending}
              onClick={async () => {
                try {
                  const r = await recall.mutateAsync([b.date]);
                  toast.success(`Took back ${r.recalled} block${r.recalled === 1 ? '' : 's'} — edit and send again`);
                  onClose();
                } catch (err) {
                  toast.error(getApiErrorMessage(err, 'Could not take it back'));
                }
              }}
            >
              Take back this day
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border-l-4 px-3 py-2" style={{ borderColor: c, background: `${c}14` }}>{b.description}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          {b.workType && <Badge>{b.workType}</Badge>}
          <Badge tone={b.billable ? 'success' : 'neutral'}>{b.billable ? 'Billable' : 'Investment'}</Badge>
        </div>
        {b.status === 'SUBMITTED' && (
          <p className="text-muted-foreground">
            With <b className="text-foreground">{b.approvers.map((a) => `${a.firstName} ${a.lastName}`).join(', ') || 'HR'}</b>{b.approverLabel ? ` · ${b.approverLabel}` : ''}
          </p>
        )}
        {b.decidedBy && (
          <p className="text-muted-foreground">
            {b.status === 'APPROVED' ? 'Approved' : 'Sent back'} by <b className="text-foreground">{b.decidedBy.firstName} {b.decidedBy.lastName}</b>
            {b.decisionNote ? ` — “${b.decisionNote}”` : ''}
          </p>
        )}
        {b.status === 'APPROVED' && <p className="text-xs text-muted-foreground">Approved time is locked.</p>}
        {b.status === 'SUBMITTED' && isOwn && <p className="text-xs text-muted-foreground">To change it, take the day back first — it goes back to “not sent”.</p>}
      </div>
    </Modal>
  );
}

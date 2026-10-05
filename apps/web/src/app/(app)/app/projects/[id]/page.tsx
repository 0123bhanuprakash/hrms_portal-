'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Activity, ArrowLeft, CheckCircle2, Circle, Flag, GitBranch, MessageSquareText, Palmtree, Pencil, Plus, SearchX, Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ProjectDialog } from '@/components/projects/project-dialog';
import { MemberDialog } from '@/components/projects/member-dialog';
import { HEALTH, HealthPill, TypeBadge, UPDATE_HEALTH, daysFrom, projectColor, shortDate } from '@/components/projects/project-ui';
import {
  PROJECT_STATUS,
  useAddMilestone,
  useCloseRole,
  useOpenRole,
  usePostUpdate,
  useProjectPlan,
  useRemoveMember,
  useRemoveMilestone,
  useSetBilled,
  useUpdateMilestone,
  type Assignment,
  type Health,
  type Milestone,
  type ProjectPlan,
} from '@/lib/company/projects';
import { useMyCard } from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type Tab = 'overview' | 'team' | 'milestones' | 'updates';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const q = useProjectPlan(id);
  const [tab, setTab] = useState<Tab>('overview');
  const [editingProject, setEditingProject] = useState(false);
  const [member, setMember] = useState<Assignment | 'new' | null>(null);
  const [milestone, setMilestone] = useState<Milestone | 'new' | null>(null);
  const [posting, setPosting] = useState(false);

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/projects?tab=all"><ArrowLeft /> Projects</Link>
    </Button>
  );
  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    return status === 404 ? <EmptyState icon={<SearchX />} title="Project not found" action={back} /> : <ErrorState message={getApiErrorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  if (q.data!.limited) {
    const l = q.data!;
    const c = projectColor(l);
    return (
      <div className="space-y-4">
        <div>{back}</div>
        <Card className="overflow-hidden">
          <span className="block h-2" style={{ background: c }} />
          <div className="flex items-center gap-4 p-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-mono text-xs font-black" style={{ background: `${c}1f`, color: c }}>{l.code.slice(0, 4)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight">{l.name}</h1><TypeBadge type={l.type} /></div>
              <p className="mt-1 text-sm text-muted-foreground">{l.clientName ?? 'Internal'}</p>
              {l.description && <p className="mt-2 max-w-2xl text-sm">{l.description}</p>}
            </div>
          </div>
        </Card>
        <EmptyState icon={<Users />} title="You’re not on this project" description="Its team, timeline and status are visible to the people on it and the PMO. Ask your manager or the PMO if you should join." />
      </div>
    );
  }
  const p = q.data!;
  const color = projectColor(p);
  const active = p.members.filter((m) => m.active);
  const done = p.milestones.filter((m) => m.doneAt).length;
  const late = p.milestones.filter((m) => !m.doneAt && m.dueDate < p.today).length;
  const next = p.milestones.find((m) => !m.doneAt);
  const daysLeft = p.endDate ? daysFrom(p.today, p.endDate) : null;
  const last = p.updates[0];

  return (
    <div className="space-y-4">
      <div>{back}</div>
      <Card className="overflow-hidden">
        <span className="block h-2" style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-mono text-xs font-black" style={{ background: `${color}1f`, color }}>{p.code.slice(0, 4)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{p.name}</h1>
              {p.status === 'ACTIVE' ? <HealthPill health={p.health} /> : <Badge tone={PROJECT_STATUS[p.status].tone} dot>{PROJECT_STATUS[p.status].label}</Badge>}
              <TypeBadge type={p.type} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.clientName ?? 'Internal'} · {formatDate(p.startDate)} – {p.endDate ? formatDate(p.endDate) : 'ongoing'}
              {active.some((m) => m.role === 'MANAGER') && ` · PM ${active.filter((m) => m.role === 'MANAGER').map((m) => `${m.employee.firstName} ${m.employee.lastName}`).join(', ')}`}
            </p>
            {p.description && <p className="mt-2 max-w-2xl text-sm">{p.description}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {p.canPlan && <Button variant="secondary" onClick={() => setPosting(true)}><MessageSquareText /> Post update</Button>}
            {p.canPlan && <Button variant="secondary" onClick={() => setMilestone('new')}><Flag /> Add milestone</Button>}
            {p.canManage && <Button variant="secondary" onClick={() => setEditingProject(true)}><Pencil /> Edit</Button>}
            {p.canManage && <Button onClick={() => setMember('new')}><UserPlus /> Assign people</Button>}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-border md:grid-cols-5">
          <Cell label="Milestones" value={p.milestones.length ? `${done} of ${p.milestones.length} done` : 'None yet'} sub={late ? `${late} late` : p.milestones.length ? 'none late' : 'add the key checkpoints'} tone={late ? 'text-destructive' : undefined} />
          <Cell label="Timeline" value={p.timePct !== null ? `${p.timePct}% gone` : 'Ongoing'} sub={daysLeft === null ? 'no end date' : daysLeft < 0 ? `${-daysLeft} days past the end` : `${daysLeft} days left`} tone={daysLeft !== null && daysLeft < 0 ? 'text-destructive' : undefined} />
          <Cell label="Team" value={`${active.length} ${active.length === 1 ? 'person' : 'people'}`} sub={[`${active.filter((m) => m.role === 'TEAM_LEAD').length} leads`, p.type === 'CLIENT' ? `${p.billedCount} billed` : null, p.awayToday.length ? `${p.awayToday.length} away today` : null].filter(Boolean).join(' · ')} />
          <Cell label="Next milestone" value={next ? next.title : '—'} sub={next ? `${shortDate(next.dueDate)} · ${daysFrom(p.today, next.dueDate) < 0 ? 'late' : `in ${daysFrom(p.today, next.dueDate)} days`}` : ' '} />
          <Cell label="Last PM update" value={last ? formatRelative(last.createdAt) : 'None yet'} sub={p.health.updateOverdue ? 'update overdue' : last ? HEALTH[last.health].label : ' '} tone={p.health.updateOverdue ? 'text-warning' : undefined} last />
        </div>
      </Card>

      {p.status === 'ACTIVE' && (p.health.reasons.length > 0 || p.health.override) && (
        <div className={cn('flex flex-wrap items-start gap-2 rounded-xl px-4 py-3 text-sm', HEALTH[p.health.level].pill)}>
          <b>{HEALTH[p.health.level].emoji} {HEALTH[p.health.level].label}</b>
          <span className="min-w-0 flex-1 text-foreground/80">
            {p.health.override ? `The PM says “${p.health.override.note}”. ` : ''}
            {p.health.reasons.length ? `${p.health.override ? 'Worked out from the plan: ' : ''}${p.health.reasons.join(' · ')}` : ''}
          </span>
        </div>
      )}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <Activity /> },
          { id: 'team', label: 'Team', icon: <Users />, count: active.length },
          { id: 'milestones', label: 'Milestones', icon: <Flag />, count: p.milestones.length },
          { id: 'updates', label: 'Updates', icon: <MessageSquareText />, count: p.updates.length },
        ]}
      />

      <div key={tab} className="animate-fade-up">
        {tab === 'overview' && (
          <div className="space-y-4">
            <Roadmap p={p} color={color} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Updates p={p} limit={3} onPost={() => setPosting(true)} />
              <div className="space-y-4">
                <Milestones p={p} onEdit={setMilestone} compact />
                <ActivityCard p={p} limit={6} />
              </div>
            </div>
          </div>
        )}
        {tab === 'team' && <Team p={p} onMember={setMember} />}
        {tab === 'milestones' && <Milestones p={p} onEdit={setMilestone} />}
        {tab === 'updates' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Updates p={p} onPost={() => setPosting(true)} />
            <ActivityCard p={p} />
          </div>
        )}
      </div>

      {editingProject && <ProjectDialog value={p} onClose={() => setEditingProject(false)} />}
      <MemberDialog project={p} value={member} onClose={() => setMember(null)} />
      {milestone && <MilestoneDialog p={p} value={milestone} onClose={() => setMilestone(null)} />}
      {posting && <UpdateDialog p={p} onClose={() => setPosting(false)} />}
    </div>
  );
}

function Cell({ label, value, sub, tone, last }: { label: string; value: string; sub: string; tone?: string; last?: boolean }) {
  return (
    <div className={cn('min-w-0 border-b border-border px-4 py-3 md:border-b-0', !last && 'md:border-r')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-base font-semibold" title={value}>{value}</p>
      <p className={cn('truncate text-xs text-muted-foreground', tone && `font-semibold ${tone}`)}>{sub}</p>
    </div>
  );
}

// ─── Roadmap ────────────────────────────────────────────────

function Roadmap({ p, color }: { p: ProjectPlan; color: string }) {
  const startMs = new Date(`${p.startDate}T00:00:00Z`).getTime();
  const endKey = p.endDate ?? p.milestones.at(-1)?.dueDate ?? p.today;
  const span = Math.max(1, new Date(`${endKey}T00:00:00Z`).getTime() - startMs);
  const at = (k: string) => Math.max(0, Math.min(100, ((new Date(`${k}T00:00:00Z`).getTime() - startMs) / span) * 100));
  const today = at(p.today);
  const points = [{ id: 'start', title: 'Start', dueDate: p.startDate, done: true }, ...p.milestones.map((m) => ({ id: m.id, title: m.title, dueDate: m.dueDate, done: Boolean(m.doneAt) })), ...(p.endDate ? [{ id: 'end', title: 'End', dueDate: p.endDate, done: p.status === 'COMPLETED' }] : [])];
  return (
    <Card>
      <CardHeader icon={<Flag />} title="Roadmap" description={`Today · ${shortDate(p.today)}`} />
      <div className="overflow-x-auto px-6 pb-6">
        <div className="relative mx-4 h-28 min-w-[560px]">
          <div className="absolute inset-x-0 top-10 h-1.5 rounded-full bg-muted" />
          <div className="absolute left-0 top-10 h-1.5 rounded-full transition-[width] duration-700" style={{ width: `${today}%`, background: `linear-gradient(90deg, ${color}, ${color}bb)` }} />
          {p.today >= p.startDate && p.today <= endKey && (
            <>
              <span className="absolute top-4 h-14 w-0.5 bg-destructive" style={{ left: `${today}%` }} />
              <span className="absolute top-0 -translate-x-1/2 text-[10px] font-bold uppercase text-destructive" style={{ left: `${today}%` }}>Today</span>
            </>
          )}
          {points.map((m, i) => {
            const late = !m.done && m.dueDate < p.today;
            return (
              <div key={m.id} className={cn('absolute top-[34px] flex -translate-x-1/2 flex-col items-center gap-1.5', i % 2 === 1 && 'top-[34px]')} style={{ left: `${at(m.dueDate)}%` }}>
                <span className={cn('h-4 w-4 rotate-45 rounded-[3px] border-[3px]', m.done ? 'border-success bg-success' : late ? 'border-destructive bg-surface' : 'border-primary bg-surface')} />
                <span className={cn('max-w-[120px] truncate text-center text-xs font-semibold', i % 2 === 1 && 'mt-0', m.done && 'text-muted-foreground')} title={m.title}>{m.title}</span>
                <span className={cn('-mt-1 text-[10px]', late ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{shortDate(m.dueDate)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ─── Status updates ─────────────────────────────────────────

function Updates({ p, limit, onPost }: { p: ProjectPlan; limit?: number; onPost: () => void }) {
  const list = limit ? p.updates.slice(0, limit) : p.updates;
  return (
    <Card>
      <CardHeader icon={<MessageSquareText />} title="Status updates" description="The PM posts one about once a week — everyone on the project sees it" />
      <div className="space-y-1 px-5 pb-5">
        {p.canPlan && (
          <button type="button" onClick={onPost} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-subtle">
            <MessageSquareText className="h-4 w-4" /> How’s the project going this week?
            <span className="ml-auto flex gap-1">{UPDATE_HEALTH.map((h) => <span key={h.id}>{h.emoji}</span>)}</span>
          </button>
        )}
        {!list.length && <p className="py-4 text-sm text-muted-foreground">No updates yet.{p.canPlan ? ' Post the first one — health then follows what you say for 2 weeks.' : ''}</p>}
        <ul className="divide-y divide-border">
          {list.map((u) => (
            <li key={u.id} className="flex items-start gap-3 py-3">
              {u.author ? <PersonAvatar person={u.author} size="sm" /> : <span className="h-8 w-8 rounded-full bg-muted" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <b>{u.author ? `${u.author.firstName} ${u.author.lastName}` : 'Someone'}</b>
                  <span className={cn('rounded-full px-2 py-0.5 font-bold', HEALTH[u.health].pill)}>{HEALTH[u.health].emoji} {HEALTH[u.health].label}</span>
                  <span className="text-muted-foreground">{formatRelative(u.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm">{u.note}</p>
              </div>
            </li>
          ))}
        </ul>
        {p.health.updateOverdue && <p className="text-xs font-semibold text-warning">No update for over 2 weeks — the PM has been reminded.</p>}
      </div>
    </Card>
  );
}

function UpdateDialog({ p, onClose }: { p: ProjectPlan; onClose: () => void }) {
  const post = usePostUpdate(p.id);
  const [health, setHealth] = useState<Health>((p.health.computed as Health) ?? 'on_track');
  const [note, setNote] = useState('');
  const submit = () =>
    post.mutate(
      { health, note: note.trim() },
      { onSuccess: () => { toast.success('Update posted — the team has been told'); onClose(); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not post')) },
    );
  return (
    <Modal
      open
      onClose={onClose}
      busy={post.isPending}
      icon={<MessageSquareText />}
      title={`Update on ${p.name}`}
      description="Everyone on the project sees it. Health follows your update for the next 2 weeks."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={post.isPending} disabled={note.trim().length < 3}>Post update</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How is it going?">
          {UPDATE_HEALTH.map((h) => (
            <button key={h.id} type="button" role="radio" aria-checked={health === h.id} onClick={() => setHealth(h.id)} className={cn('rounded-xl border-[1.5px] px-3 py-3 text-sm font-semibold transition-colors', health === h.id ? `${HEALTH[h.id].pill} border-current` : 'border-border hover:bg-subtle')}>
              <span className="block text-xl">{h.emoji}</span>{h.label}
            </button>
          ))}
        </div>
        {p.health.computed && p.health.computed !== health && <p className="text-xs text-muted-foreground">The plan says <b>{HEALTH[p.health.computed].label}</b>{p.health.reasons.length ? ` (${p.health.reasons.join(' · ')})` : ''} — say why you see it differently.</p>}
        <Field label="What’s happening?" htmlFor="pu-note"><Textarea id="pu-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={1000} placeholder="Wins, blockers, what’s next…" autoFocus /></Field>
      </div>
    </Modal>
  );
}

// ─── Milestones ─────────────────────────────────────────────

function Milestones({ p, onEdit, compact }: { p: ProjectPlan; onEdit: (m: Milestone | 'new') => void; compact?: boolean }) {
  const update = useUpdateMilestone(p.id);
  const remove = useRemoveMilestone(p.id);
  const [removing, setRemoving] = useState<Milestone | null>(null);
  const meId = useMyCard().data?.employee?.id;
  const toggle = (m: Milestone) =>
    update.mutate({ id: m.id, done: !m.doneAt }, { onSuccess: () => toast.success(m.doneAt ? 'Reopened' : `“${m.title}” done 🎉`), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update')) });
  return (
    <Card>
      <CardHeader icon={<Flag />} title="Milestones" action={p.canPlan && <Button size="sm" variant="ghost" onClick={() => onEdit('new')}><Plus /> Add</Button>} />
      <ul className="space-y-1 px-5 pb-5">
        {!p.milestones.length && <li className="py-2 text-sm text-muted-foreground">No milestones yet.{p.canPlan ? ' Add the key checkpoints — health follows them.' : ''}</li>}
        {p.milestones.map((m) => {
          const late = !m.doneAt && m.dueDate < p.today;
          return (
            <li key={m.id} className="group flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-subtle/60">
              <button type="button" onClick={() => toggle(m)} aria-label={m.doneAt ? `Reopen ${m.title}` : `Mark ${m.title} done`} className="shrink-0 disabled:cursor-default" disabled={update.isPending || !(p.canPlan || (m.owner && m.owner.id === meId))}>
                {m.doneAt ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className={cn('h-5 w-5', late ? 'text-destructive' : 'text-muted-foreground')} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium', m.doneAt && 'text-muted-foreground line-through')}>{m.title}</p>
                {!compact && <p className="text-xs text-muted-foreground">{m.owner ? `Owner ${m.owner.firstName} ${m.owner.lastName}` : 'No owner'}{m.doneAt ? ` · done ${formatRelative(m.doneAt)}` : ''}</p>}
              </div>
              {m.owner && compact && <PersonAvatar person={m.owner} size="xs" />}
              <span className={cn('shrink-0 text-xs', late ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{shortDate(m.dueDate)}{late ? ' · late' : ''}</span>
              {p.canPlan && !compact && (
                <span className="flex opacity-60 group-hover:opacity-100">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${m.title}`} onClick={() => onEdit(m)}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${m.title}`} onClick={() => setRemoving(m)}><Trash2 /></Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        isDanger
        isLoading={remove.isPending}
        title={`Delete “${removing?.title ?? ''}”?`}
        description="It disappears from the roadmap and the timeline."
        confirmText="Delete"
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => { toast.success('Milestone deleted'); setRemoving(null); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not delete')) });
        }}
      />
    </Card>
  );
}

function MilestoneDialog({ p, value, onClose }: { p: ProjectPlan; value: Milestone | 'new'; onClose: () => void }) {
  const add = useAddMilestone(p.id);
  const update = useUpdateMilestone(p.id);
  const editing = value !== 'new' ? value : null;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? (p.today > p.startDate ? p.today : p.startDate));
  const [owner, setOwner] = useState(editing?.owner?.id ?? '');
  const people = useMemo(() => {
    const seen = new Map<string, Assignment['employee']>();
    for (const m of p.members) if (m.active || m.upcoming) seen.set(m.employee.id, m.employee);
    return [...seen.values()].sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [p.members]);
  const busy = add.isPending || update.isPending;
  const submit = async () => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, title: title.trim(), dueDate, ownerEmployeeId: owner || null });
      else await add.mutateAsync({ title: title.trim(), dueDate, ownerEmployeeId: owner || null });
      toast.success(editing ? 'Milestone saved' : 'Milestone added');
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={<Flag />}
      title={editing ? 'Edit milestone' : 'Add a milestone'}
      description="A checkpoint on the roadmap. Due within 7 days and not done → at risk; over a week late → off track."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy} disabled={title.trim().length < 2 || !dueDate}>{editing ? 'Save' : 'Add milestone'}</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <Field label="Title" htmlFor="ms-title" required><Input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. UAT sign-off" autoFocus /></Field>
        <Field label="Due" htmlFor="ms-due" required><Input id="ms-due" type="date" value={dueDate} min={p.startDate} max={p.endDate ?? undefined} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="Owner" htmlFor="ms-owner" hint="They can tick it done themselves." className="sm:col-span-2">
          <select id="ms-owner" className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">— Nobody</option>
            {people.map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

// ─── Team, open roles, billing ──────────────────────────────

function Team({ p, onMember }: { p: ProjectPlan; onMember: (m: Assignment | 'new') => void }) {
  const remove = useRemoveMember(p.id);
  const billed = useSetBilled(p.id);
  const [removing, setRemoving] = useState<Assignment | null>(null);
  const groups = useMemo(() => {
    const current = p.members.filter((m) => m.active || m.upcoming);
    const leads = current.filter((m) => m.role === 'TEAM_LEAD');
    return {
      managers: current.filter((m) => m.role === 'MANAGER'),
      teams: leads.map((l) => ({ lead: l, members: current.filter((m) => m.role === 'MEMBER' && m.lead?.id === l.employee.id) })),
      direct: current.filter((m) => m.role === 'MEMBER' && (!m.lead || !leads.some((l) => l.employee.id === m.lead!.id))),
      past: p.members.filter((m) => !m.active && !m.upcoming),
    };
  }, [p.members]);

  const row = (m: Assignment, indent = false) => (
    <li key={m.id} className={cn('flex items-center gap-3 py-2.5', indent && 'pl-6 sm:pl-10')}>
      <PersonAvatar person={m.employee} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          {m.employee.firstName} {m.employee.lastName}
          {p.awayToday.includes(m.employee.id) && m.active && <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning"><Palmtree className="h-3 w-3" /> away today</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{m.employee.designation?.name ?? m.employee.employeeId} · {formatDate(m.startDate)} – {m.endDate ? formatDate(m.endDate) : 'ongoing'}</p>
      </div>
      {m.upcoming && <Badge tone="info">Starts {formatDate(m.startDate)}</Badge>}
      {p.type === 'CLIENT' &&
        (p.canManage ? (
          <button
            type="button"
            role="switch"
            aria-checked={m.billed}
            onClick={() => billed.mutate({ memberId: m.id, billed: !m.billed }, { onSuccess: () => toast.success(m.billed ? `${m.employee.firstName} is now not billed (shadow / trainee)` : `${m.employee.firstName} is billed to the client`), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not change')) })}
            className={cn('hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:inline-flex', m.billed ? 'border-primary/40 bg-primary-soft text-primary-soft-foreground' : 'border-border text-muted-foreground')}
            title="Does the client pay for this person?"
          >
            <i className={cn('h-1.5 w-1.5 rounded-full', m.billed ? 'bg-primary' : 'bg-muted-foreground')} /> {m.billed ? 'Billed' : 'Not billed'}
          </button>
        ) : (
          !m.billed && <Badge tone="neutral" className="hidden sm:inline-flex">Not billed</Badge>
        ))}
      <span className="w-12 text-right text-sm font-semibold tabular-nums">{m.allocation}%</span>
      {p.canManage && (
        <div className="flex">
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${m.employee.firstName}`} onClick={() => onMember(m)}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${m.employee.firstName}`} onClick={() => setRemoving(m)}><Trash2 /></Button>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-border bg-subtle/60 px-4 py-3 text-xs text-muted-foreground">
        <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Leave and attendance corrections: members → their team lead or the project manager · team leads → the project manager · project managers → their reporting manager.
        {p.type === 'CLIENT' ? ' Everyone counts as billable unless marked “Not billed” (shadows, trainees).' : ' Internal project — everyone’s time here is an investment.'}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<Users />} title="Team" description={`${p.members.filter((m) => m.active).length} people on the project today`} action={p.canManage && <Button size="sm" onClick={() => onMember('new')}><UserPlus /> Assign</Button>} />
          <div className="space-y-5 px-5 pb-5">
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project manager</h3>
              {groups.managers.length ? <ul className="divide-y divide-border">{groups.managers.map((m) => row(m))}</ul> : <p className="py-2 text-sm text-warning">No project manager yet — assign one so approvals have somewhere to go.</p>}
            </section>
            {groups.teams.map(({ lead, members }) => (
              <section key={lead.id}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team lead · {members.length} member{members.length === 1 ? '' : 's'}</h3>
                <ul className="divide-y divide-border">{row(lead)}{members.map((m) => row(m, true))}</ul>
              </section>
            ))}
            {groups.direct.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members without a team lead (approved by the PM)</h3>
                <ul className="divide-y divide-border">{groups.direct.map((m) => row(m))}</ul>
              </section>
            )}
            {!p.members.length && <EmptyState icon={<Users />} title="Nobody assigned yet" description={p.canManage ? 'Add a project manager, team leads and members.' : undefined} className="py-8" />}
          </div>
        </Card>
        <div className="space-y-4">
          <OpenRoles p={p} />
          <Card>
            <CardHeader title="Past assignments" />
            {groups.past.length ? <ul className="divide-y divide-border px-5 pb-3">{groups.past.map((m) => row(m))}</ul> : <p className="px-5 pb-5 text-sm text-muted-foreground">None.</p>}
          </Card>
        </div>
      </div>
      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        isDanger
        isLoading={remove.isPending}
        title={`Remove ${removing?.employee.firstName ?? ''} from ${p.name}?`}
        description={removing?.role === 'TEAM_LEAD' ? 'Their members will be approved by the project manager until you assign a new team lead. To keep history, edit the assignment and set an end date instead.' : 'To keep history, edit the assignment and set an end date instead.'}
        confirmText="Remove"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove.mutateAsync(removing.id);
            toast.success('Removed from the project');
            setRemoving(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not remove'));
          }
        }}
      />
    </div>
  );
}

function OpenRoles({ p }: { p: ProjectPlan }) {
  const open = useOpenRole(p.id);
  const close = useCloseRole(p.id);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [allocation, setAllocation] = useState(50);
  const [fromDate, setFromDate] = useState(p.today > p.startDate ? p.today : p.startDate);
  const roles = p.openRoles.filter((r) => !r.filledAt);
  return (
    <Card>
      <CardHeader icon={<UserPlus />} title="Open roles" description="Seats the project needs filled" action={p.canPlan && <Button size="sm" variant="ghost" onClick={() => setAdding(true)}><Plus /> Open</Button>} />
      <ul className="space-y-2 px-5 pb-5">
        {!roles.length && <li className="text-sm text-muted-foreground">None — fully staffed.</li>}
        {roles.map((r) => (
          <li key={r.id} className="rounded-xl border border-warning/30 bg-warning-soft/50 px-3 py-2">
            <p className="text-sm font-semibold">{r.title}</p>
            <p className="text-xs text-muted-foreground">{r.allocation}% from {shortDate(r.fromDate)}</p>
            {p.canPlan && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.canManage && <Button size="sm" variant="secondary" asChild><Link href={`/app/projects/planner?role=${r.id}`}>Find someone free</Link></Button>}
                <Button size="sm" variant="ghost" onClick={() => close.mutate({ id: r.id, filled: true }, { onSuccess: () => toast.success('Marked filled'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update')) })}>Filled</Button>
                <Button size="sm" variant="ghost" onClick={() => close.mutate({ id: r.id, filled: false }, { onSuccess: () => toast.success('Role removed'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not remove')) })}>Remove</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {adding && (
        <Modal
          open
          onClose={() => setAdding(false)}
          busy={open.isPending}
          icon={<UserPlus />}
          title="Open a role"
          description="Shows on the project and in the PMO’s resource planner with people who are free."
          footer={<><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button loading={open.isPending} disabled={title.trim().length < 2} onClick={() => open.mutate({ title: title.trim(), allocation, fromDate }, { onSuccess: () => { toast.success('Role opened'); setAdding(false); setTitle(''); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not open the role')) })}>Open role</Button></>}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_110px_160px]">
            <Field label="Role" htmlFor="or-title" required><Input id="or-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. QA engineer" autoFocus /></Field>
            <Field label="Allocation" htmlFor="or-alloc"><Input id="or-alloc" type="number" min={5} max={100} step={5} value={allocation} onChange={(e) => setAllocation(Number(e.target.value))} /></Field>
            <Field label="From" htmlFor="or-from"><Input id="or-from" type="date" value={fromDate} min={p.startDate} max={p.endDate ?? undefined} onChange={(e) => setFromDate(e.target.value)} /></Field>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function ActivityCard({ p, limit }: { p: ProjectPlan; limit?: number }) {
  const list = limit ? p.activity.slice(0, limit) : p.activity;
  return (
    <Card>
      <CardHeader icon={<Activity />} title="Recent activity" />
      <ul className="space-y-2.5 px-5 pb-5">
        {!list.length && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
        {list.map((e) => (
          <li key={e.id} className="flex items-start gap-2.5 text-sm">
            {e.actor ? <PersonAvatar person={e.actor} size="xs" className="mt-0.5" /> : <span className="mt-0.5 h-6 w-6 rounded-full bg-muted" />}
            <span className="min-w-0 flex-1"><b>{e.actor ? e.actor.firstName : 'Someone'}</b> {e.text}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(e.at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

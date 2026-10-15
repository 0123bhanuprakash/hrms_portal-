'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Crown, LifeBuoy, Lock, Paperclip, RotateCcw, Send, Sparkles, Star, X, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Journey, TargetRing } from '@/components/helpdesk/ticket-visuals';
import { Burst } from '@/components/motion/motion';
import {
  PRIORITY,
  STATUS,
  dueText,
  openAttachment,
  suggestAssignee,
  useAssignTicket,
  useHelpdeskTeams,
  useCloseTicket,
  usePostMessage,
  useQueueAgents,
  useReopenTicket,
  useResolveTicket,
  useTicket,
  useTicketCategories,
  useHelpdeskQueues,
  useUpdateTicket,
  type Priority,
  type Queue,
  type TicketDetail,
  type TicketMessage,
} from '@/lib/company/helpdesk';
import { useAuthStore } from '@/store/useAuthStore';
import { useTicketLive, useTypingSignal } from '@/lib/live/ticket';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PersonSelect, Select } from '@/components/ui/pickers';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.docx';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const q = useTicket(id);
  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isLoadingError) return (q.error as { response?: { status?: number } })?.response?.status === 404 ? <EmptyState icon={<LifeBuoy />} title="Ticket not found" /> : <ErrorState message={getApiErrorMessage(q.error, 'Could not load the ticket')} onRetry={() => void q.refetch()} />;
  return <TicketView t={q.data!} />;
}

function TicketView({ t }: { t: TicketDetail }) {
  const [resolving, setResolving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [closing, setClosing] = useState(false);
  const writer = useTicketLive(t.id);
  const fire = useSolvedMoment(t);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href={t.isAgent ? '/app/helpdesk/queue' : '/app/helpdesk'} className="hover:underline">Helpdesk · {t.queueLabel}</Link>}
        title={`#${t.number} ${t.subject}`}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
            <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label} priority</Badge>
            {t.category && <Badge>{t.category.icon ? `${t.category.icon} ` : ""}{t.category.name}</Badge>}
            {t.reopenCount > 0 && <Badge tone="warning">Reopened {t.reopenCount}×</Badge>}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {t.canResolve && <Button onClick={() => setResolving(true)}><CheckCircle2 /> Resolve</Button>}
            {t.canReopen && <Button variant="secondary" onClick={() => setReopening(true)}><RotateCcw /> Not fixed — reopen</Button>}
            {t.canClose && <Button variant={t.status === 'RESOLVED' ? 'primary' : 'ghost'} onClick={() => setClosing(true)}>{t.status === 'RESOLVED' ? <><Star /> Close and rate</> : <><X /> Withdraw</>}</Button>}
          </div>
        }
      />

      <Card className="relative flex items-center gap-4 px-4 py-3">
        <span className="text-xl" aria-hidden>{t.queueEmoji}</span>
        <Journey t={t} className="flex-1" />
        <span className="pointer-events-none absolute right-1/3 top-1/2"><Burst fire={fire} count={18} spread={120} /></span>
      </Card>

      {t.isMine && t.status === 'RESOLVED' && t.autoCloseAt && (
        <div className="rounded-md border border-success/30 bg-success-soft px-4 py-3 text-sm">
          {t.queueLabel} marked this resolved. If it’s still not fixed, reopen it — otherwise it closes on its own {formatRelative(t.autoCloseAt)}.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {(Boolean(t.answers?.length) || t.asset) && <Answers t={t} />}
          <Thread t={t} writer={writer} />
          {(t.canReply || t.canNote) && <Composer t={t} />}
          {t.status === 'CLOSED' && <p className="text-center text-sm text-muted-foreground">This ticket is closed.{t.isMine && ' Raise a new one if you still need help.'}</p>}
        </div>
        <Side t={t} />
      </div>

      {resolving && <ResolveDialog t={t} onClose={() => setResolving(false)} />}
      {reopening && <ReopenDialog t={t} onClose={() => setReopening(false)} />}
      {closing && <CloseDialog t={t} onClose={() => setClosing(false)} />}
    </div>
  );
}

// ─── Conversation ───────────────────────────────────────────

/** The topic's questions as the employee answered them, and the device they picked. */
function Answers({ t }: { t: TicketDetail }) {
  return (
    <Card className="p-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {(t.answers ?? []).map((a) => (
          <div key={a.label}>
            <dt className="text-xs text-muted-foreground">{a.label}</dt>
            <dd className="font-medium">{a.answer}</dd>
          </div>
        ))}
      </dl>
      {t.asset && (
        <Link href={t.isAgent ? `/app/assets/${t.asset.id}` : '/app/assets/mine'} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs hover:bg-subtle">
          💻 <span className="font-mono font-semibold">{t.asset.tag}</span> {t.asset.name}
        </Link>
      )}
    </Card>
  );
}

function Thread({ t, writer }: { t: TicketDetail; writer: string | null }) {
  const me = useAuthStore((s) => s.user?.id);
  const team = t.queueLabel;
  return (
    <Card className="space-y-3 bg-gradient-to-b from-subtle/50 to-transparent p-4 sm:p-5">
      {t.messages.map((m, i) => {
        if (m.kind === 'EVENT') return <EventPill key={m.id} m={m} t={t} />;
        const mine = m.authorId === me;
        // The reply saved together with "Marked as resolved" is the resolution
        const resolution = m.kind === 'REPLY' && t.messages[i + 1]?.kind === 'EVENT' && t.messages[i + 1]?.body === 'Marked as resolved';
        if (resolution) {
          return (
            <div key={m.id} className="rounded-xl border border-success/40 bg-success-soft/50 p-4 animate-fade-up">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-success" /> Resolved by {mine ? 'you' : m.author ? m.author.firstName : team}
                <span className="text-xs font-normal text-muted-foreground" title={formatDateTime(m.createdAt)}>· {formatRelative(m.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm"><span className="font-medium">What we did: </span>{m.body}</p>
              {m.fileName && <Attachment ticketId={t.id} m={m} />}
            </div>
          );
        }
        if (m.kind === 'NOTE') {
          return (
            <div key={m.id} className="rounded-xl border border-dashed border-warning/60 bg-warning-soft/40 px-4 py-3 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-warning"><Lock className="h-3.5 w-3.5" /> Internal note · {m.authorId === me ? 'you' : m.author?.firstName ?? 'Someone'} · {formatRelative(m.createdAt)}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
              {m.fileName && <Attachment ticketId={t.id} m={m} />}
            </div>
          );
        }
        return (
          <div key={m.id} className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
            {!mine && (m.author ? <PersonAvatar person={m.author} size="sm" /> : <span className="h-8 w-8" />)}
            <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border bg-card')}>
              {!mine && (
                <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium">
                  {m.author ? `${m.author.firstName} ${m.author.lastName}` : 'Someone'}
                  {m.fromAgent && <Badge className="px-1.5 py-0 text-2xs">{team}</Badge>}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              {m.fileName && <Attachment ticketId={t.id} m={m} />}
              <p className={cn('mt-1 text-right text-2xs', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')} title={formatDateTime(m.createdAt)}>{formatRelative(m.createdAt)}</p>
            </div>
          </div>
        );
      })}
      {writer && <Writing name={writer} />}
    </Card>
  );
}

/** Centered pill for things that happened (picked up, waiting for you, moved…). */
function EventPill({ m, t }: { m: TicketMessage; t: TicketDetail }) {
  const me = useAuthStore((s) => s.user?.id);
  if (m.body === 'Marked as resolved') return null;
  const waiting = m.body === 'Asked the employee for more information';
  const who = m.authorId === me ? 'You' : m.author ? m.author.firstName : 'System';
  const text = waiting && t.isMine ? `⏸ ${who} asked you for more information — the clock is paused until you reply` : `${who} · ${m.body.charAt(0).toLowerCase() + m.body.slice(1)}`;
  return (
    <p className={cn('mx-auto w-fit max-w-full rounded-full border px-3 py-1 text-center text-xs', waiting ? 'border-warning/40 bg-warning-soft text-warning' : 'border-border bg-background text-muted-foreground')} title={formatDateTime(m.createdAt)}>
      {text} · {formatRelative(m.createdAt)}
    </p>
  );
}

/** A soft burst once: when the ticket gets resolved while open, or the requester's first visit after. */
function useSolvedMoment(t: TicketDetail): number {
  const [fire, setFire] = useState(0);
  const last = useRef(t.status);
  useEffect(() => {
    const key = `hd-solved-seen:${t.id}`;
    let seen = true;
    try {
      seen = localStorage.getItem(key) === '1';
    } catch {
      /* storage blocked — no first-visit burst */
    }
    const justResolved = last.current !== 'RESOLVED' && t.status === 'RESOLVED';
    last.current = t.status;
    if (t.status === 'RESOLVED' && (justResolved || (t.isMine && !seen))) {
      setFire((n) => n + 1);
      try {
        localStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
    }
  }, [t.id, t.status, t.isMine]);
  return fire;
}

/** "Rohit is writing…" — live from the other side of the conversation. */
function Writing({ name }: { name: string }) {
  return (
    <p className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground animate-fade-up" role="status" aria-live="polite">
      <span className="inline-flex gap-1" aria-hidden>
        {[0, 150, 300].map((d) => (
          <span key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
      {name} is writing…
    </p>
  );
}

function Attachment({ ticketId, m }: { ticketId: string; m: TicketMessage }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-subtle disabled:opacity-60"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await openAttachment(ticketId, m);
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'Could not open the file'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Paperclip className="h-3.5 w-3.5" /> {m.fileName} {m.fileSize ? <span className="text-muted-foreground">({Math.max(1, Math.round(m.fileSize / 1024))} KB)</span> : null}
    </button>
  );
}

function Composer({ t }: { t: TicketDetail }) {
  const post = usePostMessage(t.id);
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [wait, setWait] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  // Not yours yet (the head assigns): internal notes only
  const notesOnly = !t.canReply && t.canNote;
  const note = t.isAgent && (mode === 'note' || notesOnly);
  const typing = useTypingSignal(t.id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post.mutateAsync({ body, internal: note || undefined, waitForEmployee: t.isAgent && !note && wait ? true : undefined, file });
      typing.done();
      setBody('');
      setFile(null);
      setWait(false);
      toast.success(note ? 'Note added' : 'Sent');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send'));
    }
  };

  return (
    <Card className={cn('p-4', note && 'border-warning/40')}>
      <form onSubmit={submit} className="space-y-3">
        {notesOnly && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> This ticket isn’t assigned to you — you can add an internal note for the team. The {t.queueLabel} head assigns tickets.</p>
        )}
        {t.isAgent && !notesOnly && (
          <div className="flex gap-1 text-sm">
            {(['reply', 'note'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded-md px-2.5 py-1', mode === m ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}>
                {m === 'reply' ? `Reply to ${t.employee.firstName}` : 'Internal note'}
              </button>
            ))}
          </div>
        )}
        <Textarea
          rows={4}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            // Internal notes stay private — no "is writing" for them
            if (note) typing.done();
            else typing.typed();
          }}
          // Enter sends, Shift+Enter adds a new line (not while an IME is composing)
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (body.trim() && !post.isPending) e.currentTarget.form?.requestSubmit();
          }}
          required
          maxLength={5000}
          placeholder={note ? 'Only your team sees this' : t.isAgent ? 'Write a reply…' : 'Add details or answer the team’s question…'}
          aria-label="Message"
        />
        <div className="flex flex-wrap items-center gap-3">
          {file ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-sm">
              <Paperclip className="h-3.5 w-3.5" /> {file.name}
              <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </span>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Paperclip className="h-4 w-4" /> Attach
              <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {t.isAgent && !note && t.status !== 'RESOLVED' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={wait} onChange={(e) => setWait(e.target.checked)} /> Waiting for their reply
            </label>
          )}
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Enter to send · Shift+Enter for a new line</span>
          <Button type="submit" className="ml-auto sm:ml-0" loading={post.isPending} disabled={!body.trim()}><Send /> {note ? 'Add note' : 'Send'}</Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Side panel ─────────────────────────────────────────────

function Side({ t }: { t: TicketDetail }) {
  const running = t.status === 'OPEN' || t.status === 'IN_PROGRESS';
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Raised by</h2>
        <div className="flex items-center gap-2.5">
          <PersonAvatar person={t.employee} />
          <div className="min-w-0">
            <p className="truncate font-medium">{t.employee.firstName} {t.employee.lastName}</p>
            <p className="truncate text-xs text-muted-foreground">{[t.employee.designation?.name, t.employee.department?.name].filter(Boolean).join(' · ') || t.employee.employeeId}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</p>
      </Card>

      <Card className="space-y-3 p-5 text-sm">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Targets</h2><TargetRing t={t} size={40} /></div>
        <Target label="First reply" done={t.firstRespondedAt} due={t.firstResponseDueAt} running={running} />
        <Target label="Resolution" done={t.resolvedAt} due={t.resolutionDueAt} running={running} />
        {t.rating !== null && (
          <div>
            <p className="text-xs text-muted-foreground">Rating</p>
            <p className="text-warning">{'★'.repeat(t.rating)}<span className="text-muted-foreground/40">{'★'.repeat(5 - t.rating)}</span></p>
            {t.ratingComment && <p className="text-xs text-muted-foreground">“{t.ratingComment}”</p>}
          </div>
        )}
      </Card>

      {t.isAgent && t.status !== 'CLOSED' ? <AgentPanel t={t} /> : (
        <Card className="p-5 text-sm">
          <p className="text-xs text-muted-foreground">Handled by</p>
          <p className="mt-0.5">{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : `${t.queueLabel} team`}</p>
        </Card>
      )}
    </div>
  );
}

function Target({ label, done, due, running }: { label: string; done: string | null; due: string; running: boolean }) {
  const late = done ? new Date(done) > new Date(due) : false;
  const d = dueText(due);
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {done ? (
        <p className={cn('flex items-center gap-1', late ? 'text-warning' : 'text-success')}>
          {late ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {formatRelative(done)}{late && ' (late)'}
        </p>
      ) : running ? (
        <p className={cn('flex items-center gap-1', d.late && 'font-medium text-destructive')} title={formatDateTime(due)}><Clock className="h-3.5 w-3.5" /> {d.text}</p>
      ) : (
        <p className="text-muted-foreground">—</p>
      )}
    </div>
  );
}

function AgentPanel({ t }: { t: TicketDetail }) {
  const router = useRouter();
  const me = useAuthStore((s) => s.user?.id);
  const headed = Boolean(t.teamHeadId);
  const agents = useQueueAgents(t.queue, t.canAssign && !headed);
  const teams = useHelpdeskTeams(t.canAssign && headed);
  const team = teams.data?.teams.find((x) => x.queue === t.queue);
  const cats = useTicketCategories(false);
  const assign = useAssignTicket(t.id);
  const update = useUpdateTicket(t.id);
  const [moveTo, setMoveTo] = useState<Queue | null>(null);
  const queues = useHelpdeskQueues();
  const resolved = t.status === 'RESOLVED';
  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the ticket'));
    }
  };
  const people = headed
    ? (team?.members ?? []).filter((m) => m.inQueue && m.active && m.id !== t.requesterUserId)
    : (agents.data ?? []).filter((a) => a.email !== t.employee.email);
  const suggestion = headed && !t.assignee && t.canAssign ? suggestAssignee(team, t.requesterUserId) : null;
  const label = (a: (typeof people)[number]) => {
    if (a.id === me) return 'Me';
    const m = team?.members.find((x) => x.id === a.id);
    return `${a.firstName} ${a.lastName}${m ? ` — ${m.open} open${m.awayToday ? ' · on leave today' : ''}` : ''}`;
  };

  return (
    <Card className="space-y-3 p-5 text-sm">
      {t.canAssign ? (
        <Field label="Assignee" htmlFor="tk-assignee" hint={headed ? 'You lead this team — you choose who works it.' : undefined}>
          <div className="flex gap-2">
            <PersonSelect
              id="tk-assignee"
              className="min-w-0 flex-1"
              value={t.assignee?.id ?? ''}
              disabled={assign.isPending}
              onChange={(v) => void run(assign.mutateAsync(v || null), 'Assignee updated')}
              emptyLabel="Unassigned"
              people={[
                ...(t.assignee && !people.some((a) => a.id === t.assignee!.id) ? [t.assignee] : []),
                ...people.map((a) => ({ ...a, sub: label(a).replace(`${a.firstName} ${a.lastName}`, '').replace(/^\s*[—-]\s*/, '') || null })),
              ]}
            />
            {!headed && t.assignee?.id !== me && me && people.some((a) => a.id === me) && (
              <Button size="sm" variant="soft" className="h-9 shrink-0" onClick={() => void run(assign.mutateAsync(me), 'It’s yours')}>Take it</Button>
            )}
          </div>
          {suggestion && (
            <Button size="sm" variant="soft" className="mt-2 w-full justify-start" loading={assign.isPending} onClick={() => void run(assign.mutateAsync(suggestion.id), `Assigned to ${suggestion.firstName}`)}>
              <Sparkles /> Assign to {suggestion.id === me ? 'me' : suggestion.firstName} <span className="ml-auto text-xs font-normal text-muted-foreground">{suggestion.open} open · free today</span>
            </Button>
          )}
        </Field>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground">Assignee</p>
          <p className="mt-0.5">{t.assignee ? (t.assignee.id === me ? 'You' : `${t.assignee.firstName} ${t.assignee.lastName}`) : <span className="flex items-center gap-1.5 text-muted-foreground"><Crown className="h-3.5 w-3.5" /> Waiting for the {t.queueLabel} head to assign</span>}</p>
        </div>
      )}
      <Field label="Priority" htmlFor="tk-prio" hint="Changing it resets the targets from when the ticket was raised.">
        <Select id="tk-prio" className={inputClass} value={t.priority} disabled={update.isPending || !t.canWork} onChange={(e) => void run(update.mutateAsync({ priority: e.target.value as Priority }), 'Priority updated')}>
          {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
        </Select>
      </Field>
      {resolved ? (
        <div>
          <p className="text-xs text-muted-foreground">Team · Topic</p>
          <p className="mt-0.5">{t.queueLabel} · {t.category?.name ?? 'No topic'}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Locked once resolved</p>
        </div>
      ) : (
      <Field label="Topic" htmlFor="tk-topic">
        <Select id="tk-topic" className={inputClass} value={t.category?.id ?? ''} disabled={update.isPending || !t.canWork} onChange={(e) => void run(update.mutateAsync({ categoryId: e.target.value || null }), 'Topic updated')}>
          <option value="">None</option>
          {(cats.data ?? []).filter((c) => c.queue === t.queue).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      )}
      {!resolved && <Field label="Wrong team?" htmlFor="tk-move">
        <Select id="tk-move" className={inputClass} value="" disabled={!t.canWork} onChange={(e) => e.target.value && setMoveTo(e.target.value as Queue)}>
          <option value="">Move to…</option>
          {queues.open.filter((q) => q.queue !== t.queue).map((q) => <option key={q.queue} value={q.queue}>{q.emoji} {q.label}</option>)}
        </Select>
      </Field>}
      {moveTo && (
        <Modal
          open
          onClose={() => setMoveTo(null)}
          busy={update.isPending}
          title={`Move #${t.number} to ${queues.info(moveTo).label}?`}
          description="It leaves your queue and loses its assignee and topic. The other team is notified."
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setMoveTo(null)}>Cancel</Button>
              <Button
                loading={update.isPending}
                onClick={async () => {
                  try {
                    const r = await update.mutateAsync({ queue: moveTo });
                    toast.success(`Moved to ${queues.info(moveTo).label}`);
                    setMoveTo(null);
                    if ('moved' in r) router.push('/app/helpdesk/queue');
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, 'Could not move the ticket'));
                  }
                }}
              >
                Move
              </Button>
            </>
          }
        />
      )}
    </Card>
  );
}

// ─── Dialogs ────────────────────────────────────────────────

function TextDialog({ title, description, label, submit, busy, onClose, minLength = 3, danger }: { title: string; description?: string; label: string; submit: (text: string) => Promise<void>; busy: boolean; onClose: () => void; minLength?: number; danger?: boolean }) {
  const [text, setText] = useState('');
  return (
    <Modal open onClose={onClose} busy={busy} title={title} description={description} size="sm"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="text-dialog" variant={danger ? 'danger' : 'primary'} loading={busy}>{title.split(' ')[0]}</Button></>}>
      <form id="text-dialog" onSubmit={(e) => { e.preventDefault(); void submit(text); }}>
        <Field label={label} htmlFor="td-text" required><Textarea id="td-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} required minLength={minLength} maxLength={5000} /></Field>
      </form>
    </Modal>
  );
}

function ResolveDialog({ t, onClose }: { t: TicketDetail; onClose: () => void }) {
  const resolve = useResolveTicket(t.id);
  return (
    <TextDialog
      title="Resolve ticket"
      description={`${t.employee.firstName} sees this and can reopen within 7 days.`}
      label="What did you do?"
      busy={resolve.isPending}
      onClose={onClose}
      submit={async (text) => {
        try {
          await resolve.mutateAsync(text);
          toast.success('Resolved');
          onClose();
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'Could not resolve'));
        }
      }}
    />
  );
}

function ReopenDialog({ t, onClose }: { t: TicketDetail; onClose: () => void }) {
  const reopen = useReopenTicket(t.id);
  return (
    <TextDialog
      title="Reopen ticket"
      description={`${t.queueLabel} will pick it up again.`}
      label="What’s still wrong?"
      busy={reopen.isPending}
      onClose={onClose}
      submit={async (text) => {
        try {
          await reopen.mutateAsync(text);
          toast.success('Reopened');
          onClose();
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'Could not reopen'));
        }
      }}
    />
  );
}

const FACES: Array<[string, string]> = [['😞', 'Bad'], ['🙁', 'Not great'], ['😐', 'Okay'], ['🙂', 'Good'], ['🤩', 'Great']];

function CloseDialog({ t, onClose }: { t: TicketDetail; onClose: () => void }) {
  const close = useCloseTicket(t.id);
  const resolved = t.status === 'RESOLVED';
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const submit = async () => {
    try {
      await close.mutateAsync(resolved && rating ? { rating, comment: comment || null } : {});
      toast.success(resolved ? 'Thanks for the feedback' : 'Ticket withdrawn');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not close'));
    }
  };
  return (
    <Modal open onClose={onClose} busy={close.isPending} title={resolved ? 'Close and rate' : 'Withdraw this ticket?'} description={resolved ? `How did ${t.queueLabel} do?` : 'Use this if you no longer need help. It can’t be reopened.'} size="sm"
      footer={<><Button variant="secondary" onClick={onClose} disabled={close.isPending}>Cancel</Button><Button variant={resolved ? 'primary' : 'danger'} loading={close.isPending} onClick={() => void submit()}>{resolved ? 'Close ticket' : 'Withdraw'}</Button></>}>
      {resolved && (
        <div className="space-y-3">
          <div className="flex justify-center gap-3 py-1" role="radiogroup" aria-label="Rating">
            {FACES.map(([face, label], i) => (
              <button key={label} type="button" role="radio" aria-checked={rating === i + 1} aria-label={`${i + 1} — ${label}`} title={label} onClick={() => setRating(i + 1)}
                className={cn('emo-host hd-face text-4xl leading-none', rating && rating !== i + 1 ? 'opacity-40 grayscale' : '')}><Emoji e={face} fire={rating === i + 1 ? 1 : 0} /></button>
            ))}
          </div>
          {rating > 0 && <p className="text-center text-sm font-medium">{FACES[rating - 1]![1]}</p>}
          {rating > 0 && <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Anything to add? (optional)" aria-label="Comment" />}
        </div>
      )}
    </Modal>
  );
}

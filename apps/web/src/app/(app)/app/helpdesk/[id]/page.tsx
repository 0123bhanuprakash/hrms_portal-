'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Clock, LifeBuoy, Lock, Paperclip, RotateCcw, Send, Star, X, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import {
  PRIORITY,
  QUEUES,
  QUEUE_INFO,
  STATUS,
  dueText,
  openAttachment,
  useAssignTicket,
  useCloseTicket,
  usePostMessage,
  useQueueAgents,
  useReopenTicket,
  useResolveTicket,
  useTicket,
  useTicketCategories,
  useUpdateTicket,
  type Priority,
  type Queue,
  type TicketDetail,
  type TicketMessage,
} from '@/lib/company/helpdesk';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.docx';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const q = useTicket(id);
  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isError) return (q.error as { response?: { status?: number } })?.response?.status === 404 ? <EmptyState icon={<LifeBuoy />} title="Ticket not found" /> : <ErrorState message={getApiErrorMessage(q.error, 'Could not load the ticket')} onRetry={() => void q.refetch()} />;
  return <TicketView t={q.data!} />;
}

function TicketView({ t }: { t: TicketDetail }) {
  const [resolving, setResolving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [closing, setClosing] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href={t.isAgent ? '/app/helpdesk/queue' : '/app/helpdesk'} className="hover:underline">Helpdesk · {QUEUE_INFO[t.queue].label}</Link>}
        title={`#${t.number} ${t.subject}`}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
            <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label} priority</Badge>
            {t.category && <Badge>{t.category.name}</Badge>}
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

      {t.isMine && t.status === 'RESOLVED' && t.autoCloseAt && (
        <div className="rounded-md border border-success/30 bg-success-soft px-4 py-3 text-sm">
          {QUEUE_INFO[t.queue].label} marked this resolved. If it’s still not fixed, reopen it — otherwise it closes on its own {formatRelative(t.autoCloseAt)}.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Thread t={t} />
          {t.canReply && <Composer t={t} />}
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

function Thread({ t }: { t: TicketDetail }) {
  const me = useAuthStore((s) => s.user?.id);
  return (
    <Card className="divide-y divide-border">
      {t.messages.map((m) =>
        m.kind === 'EVENT' ? (
          <p key={m.id} className="px-5 py-2 text-xs text-muted-foreground">
            {m.author ? `${m.author.firstName} ${m.author.lastName}` : 'System'} · {m.body.charAt(0).toLowerCase() + m.body.slice(1)} · {formatRelative(m.createdAt)}
          </p>
        ) : (
          <div key={m.id} className={cn('flex gap-3 px-5 py-4', m.kind === 'NOTE' && 'bg-warning-soft/40')}>
            {m.author ? <PersonAvatar person={m.author} size="sm" /> : <span className="h-8 w-8" />}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-medium">{m.authorId === me ? 'You' : m.author ? `${m.author.firstName} ${m.author.lastName}` : 'Someone'}</span>
                {m.fromAgent && <Badge className="px-1.5 py-0 text-2xs">{QUEUE_INFO[t.queue].label}</Badge>}
                {m.kind === 'NOTE' && <Badge tone="warning" className="px-1.5 py-0 text-2xs"><Lock className="mr-0.5 h-3 w-3" /> Internal note</Badge>}
                <span className="text-xs text-muted-foreground" title={formatDateTime(m.createdAt)}>{formatRelative(m.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p>
              {m.fileName && <Attachment ticketId={t.id} m={m} />}
            </div>
          </div>
        ),
      )}
    </Card>
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
  const note = t.isAgent && mode === 'note';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post.mutateAsync({ body, internal: note || undefined, waitForEmployee: t.isAgent && !note && wait ? true : undefined, file });
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
        {t.isAgent && (
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
          onChange={(e) => setBody(e.target.value)}
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
          <Button type="submit" className="ml-auto" loading={post.isPending} disabled={!body.trim()}><Send /> {note ? 'Add note' : 'Send'}</Button>
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
        <h2 className="text-sm font-semibold">Targets</h2>
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
          <p className="mt-0.5">{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : `${QUEUE_INFO[t.queue].label} team`}</p>
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
  const agents = useQueueAgents(t.queue);
  const cats = useTicketCategories(false);
  const assign = useAssignTicket(t.id);
  const update = useUpdateTicket(t.id);
  const [moveTo, setMoveTo] = useState<Queue | null>(null);
  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the ticket'));
    }
  };
  const people = (agents.data ?? []).filter((a) => a.email !== t.employee.email);

  return (
    <Card className="space-y-3 p-5 text-sm">
      <Field label="Assignee" htmlFor="tk-assignee">
        <div className="flex gap-2">
          <select id="tk-assignee" className={inputClass} value={t.assignee?.id ?? ''} disabled={assign.isPending} onChange={(e) => void run(assign.mutateAsync(e.target.value || null), 'Assignee updated')}>
            <option value="">Unassigned</option>
            {people.map((a) => <option key={a.id} value={a.id}>{a.id === me ? 'Me' : `${a.firstName} ${a.lastName}`}</option>)}
          </select>
          {t.assignee?.id !== me && me && people.some((a) => a.id === me) && (
            <Button size="sm" variant="soft" className="h-9 shrink-0" onClick={() => void run(assign.mutateAsync(me), 'It’s yours')}>Take it</Button>
          )}
        </div>
      </Field>
      <Field label="Priority" htmlFor="tk-prio" hint="Changing it resets the targets from when the ticket was raised.">
        <select id="tk-prio" className={inputClass} value={t.priority} disabled={update.isPending} onChange={(e) => void run(update.mutateAsync({ priority: e.target.value as Priority }), 'Priority updated')}>
          {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
        </select>
      </Field>
      <Field label="Topic" htmlFor="tk-topic">
        <select id="tk-topic" className={inputClass} value={t.category?.id ?? ''} disabled={update.isPending} onChange={(e) => void run(update.mutateAsync({ categoryId: e.target.value || null }), 'Topic updated')}>
          <option value="">None</option>
          {(cats.data ?? []).filter((c) => c.queue === t.queue).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Wrong team?" htmlFor="tk-move">
        <select id="tk-move" className={inputClass} value="" onChange={(e) => e.target.value && setMoveTo(e.target.value as Queue)}>
          <option value="">Move to…</option>
          {QUEUES.filter((q) => q !== t.queue).map((q) => <option key={q} value={q}>{QUEUE_INFO[q].label}</option>)}
        </select>
      </Field>
      {moveTo && (
        <Modal
          open
          onClose={() => setMoveTo(null)}
          busy={update.isPending}
          title={`Move #${t.number} to ${QUEUE_INFO[moveTo].label}?`}
          description="It leaves your queue and loses its assignee and topic. The other team is notified."
          className="sm:max-w-md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setMoveTo(null)}>Cancel</Button>
              <Button
                loading={update.isPending}
                onClick={async () => {
                  try {
                    const r = await update.mutateAsync({ queue: moveTo });
                    toast.success(`Moved to ${QUEUE_INFO[moveTo].label}`);
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
    <Modal open onClose={onClose} busy={busy} title={title} description={description} className="sm:max-w-md"
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
      description={`${QUEUE_INFO[t.queue].label} will pick it up again.`}
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
    <Modal open onClose={onClose} busy={close.isPending} title={resolved ? 'Close and rate' : 'Withdraw this ticket?'} description={resolved ? `How did ${QUEUE_INFO[t.queue].label} do?` : 'Use this if you no longer need help. It can’t be reopened.'} className="sm:max-w-md"
      footer={<><Button variant="secondary" onClick={onClose} disabled={close.isPending}>Cancel</Button><Button variant={resolved ? 'primary' : 'danger'} loading={close.isPending} onClick={() => void submit()}>{resolved ? 'Close ticket' : 'Withdraw'}</Button></>}>
      {resolved && (
        <div className="space-y-3">
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setRating(n)} className={cn('text-3xl leading-none transition-colors', n <= rating ? 'text-warning' : 'text-muted-foreground/30 hover:text-warning/60')}>★</button>
            ))}
          </div>
          {rating > 0 && <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Anything to add? (optional)" aria-label="Comment" />}
        </div>
      )}
    </Modal>
  );
}

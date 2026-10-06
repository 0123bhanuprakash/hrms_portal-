'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowUpRight, Eye, Lock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, Skeleton } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Journey } from '@/components/helpdesk/ticket-visuals';
import { PRIORITY, QUEUE_INFO, STATUS, usePostMessage, useTicket } from '@/lib/company/helpdesk';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export const PREVIEW_REPLY_ID = 'queue-preview-reply';

/** Queue → click a row: peek at the ticket and reply without leaving the list. */
export function QueuePreview({ id }: { id: string | null }) {
  if (!id) {
    return (
      <Card className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <Eye className="h-5 w-5" />
        Click a ticket to peek at it here. <span className="text-xs">Press <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> to open it in full.</span>
      </Card>
    );
  }
  return <Preview key={id} id={id} />;
}

function Preview({ id }: { id: string }) {
  const me = useAuthStore((s) => s.user?.id);
  const q = useTicket(id);
  const post = usePostMessage(id);
  const [body, setBody] = useState('');
  const [note, setNote] = useState(false);
  const [ask, setAsk] = useState(false);
  if (q.isLoading) return <Skeleton className="h-80 w-full" />;
  const t = q.data;
  if (!t) return <Card className="p-4 text-sm text-muted-foreground">This ticket can’t be shown.</Card>;

  const notesOnly = !t.canReply && t.canNote;
  const asNote = note || notesOnly;
  const recent = t.messages.filter((m) => m.kind !== 'EVENT').slice(-3);
  const send = async () => {
    try {
      await post.mutateAsync({ body, internal: asNote || undefined, waitForEmployee: !asNote && ask ? true : undefined });
      setBody('');
      setAsk(false);
      toast.success(asNote ? 'Note added' : `Sent to ${t.employee.firstName}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send'));
    }
  };

  return (
    <Card className="space-y-3 p-4 animate-fade-up">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono font-semibold">#{t.number}</span> {QUEUE_INFO[t.queue].label}
            <Badge tone={PRIORITY[t.priority].tone} className="px-1.5 py-0 text-2xs">{PRIORITY[t.priority].label}</Badge>
            <Badge tone={STATUS[t.status].tone} className="px-1.5 py-0 text-2xs">{STATUS[t.status].label}</Badge>
          </p>
          <p className="mt-0.5 font-semibold leading-snug">{t.subject}</p>
        </div>
        <Button size="icon-sm" variant="ghost" asChild aria-label="Open the full ticket"><Link href={`/app/helpdesk/${t.id}`}><ArrowUpRight /></Link></Button>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <PersonAvatar person={t.employee} size="sm" />
        <span className="min-w-0 flex-1 truncate">{t.employee.firstName} {t.employee.lastName}{t.employee.designation ? ` · ${t.employee.designation.name}` : ''}</span>
      </div>
      <Journey t={t} />
      {t.answers?.length ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-subtle p-2 text-2xs">
          {t.answers.map((a) => <div key={a.label} className="min-w-0"><dt className="truncate text-muted-foreground">{a.label}</dt><dd className="truncate font-medium">{a.answer}</dd></div>)}
        </dl>
      ) : null}
      <div className="space-y-2">
        {recent.map((m) => (
          <div key={m.id} className={cn('rounded-lg px-3 py-2 text-xs', m.kind === 'NOTE' ? 'border border-dashed border-warning/50 bg-warning-soft/40' : m.authorId === me ? 'bg-primary-soft' : 'bg-subtle')}>
            <p className="mb-0.5 flex items-center gap-1 font-medium">
              {m.kind === 'NOTE' && <Lock className="h-3 w-3 text-warning" />}
              {m.authorId === me ? 'You' : m.author?.firstName ?? 'Someone'} <span className="font-normal text-muted-foreground">· {formatRelative(m.createdAt)}</span>
            </p>
            <p className="line-clamp-4 whitespace-pre-wrap break-words">{m.body}</p>
          </div>
        ))}
      </div>
      {(t.canReply || t.canNote) && (
        <div className="space-y-2 border-t border-border pt-3">
          {!notesOnly && t.canNote && (
            <div className="flex gap-1 text-xs">
              {([false, true] as const).map((n) => (
                <button key={String(n)} type="button" onClick={() => setNote(n)} className={cn('rounded-md px-2 py-1', note === n ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}>
                  {n ? 'Internal note' : `Reply to ${t.employee.firstName}`}
                </button>
              ))}
            </div>
          )}
          {notesOnly && <p className="flex items-center gap-1 text-2xs text-muted-foreground"><Lock className="h-3 w-3" /> Not assigned to you — internal notes only.</p>}
          <Textarea
            id={PREVIEW_REPLY_ID}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && body.trim()) void send(); }}
            maxLength={5000}
            placeholder={asNote ? 'Only your team sees this' : 'Quick reply… (Ctrl + Enter sends)'}
            aria-label="Quick reply"
            className={cn(asNote && 'border-warning/50')}
          />
          <div className="flex items-center gap-2">
            {!asNote && t.status !== 'RESOLVED' && (
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={ask} onChange={(e) => setAsk(e.target.checked)} /> Ask {t.employee.firstName} for details</label>
            )}
            <Button size="sm" className="ml-auto" loading={post.isPending} disabled={!body.trim()} onClick={() => void send()}><Send /> {asNote ? 'Add note' : 'Send'}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

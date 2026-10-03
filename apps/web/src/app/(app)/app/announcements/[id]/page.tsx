'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Download, Mail, Megaphone, Pencil, Pin, SearchX, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { AnnouncementDialog } from '@/components/engagement/announcement-dialog';
import {
  downloadAnnouncementAttachment,
  useAcknowledge,
  useAnnouncement,
  useAnnouncementReport,
  useDeleteAnnouncement,
} from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative } from '@/lib/format';

export default function AnnouncementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useAnnouncement(id);
  const ack = useAcknowledge();
  const del = useDeleteAnnouncement();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/announcements"><ArrowLeft /> Announcements</Link>
    </Button>
  );
  if (q.isLoading) return <Skeleton className="h-80 w-full" />;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    return status === 404 ? <EmptyState icon={<SearchX />} title="Announcement not found" action={back} /> : <ErrorState message={getApiErrorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const a = q.data!;

  const confirm = async () => {
    try {
      await ack.mutateAsync(a.id);
      await q.refetch();
      toast.success('Thanks — confirmed');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not confirm'));
    }
  };
  const download = async () => {
    setDownloading(true);
    try {
      await downloadAnnouncementAttachment(a);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not download'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>{back}</div>
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"><Megaphone className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {a.author ? `${a.author.firstName} ${a.author.lastName}` : 'HR'} · {formatDateTime(a.publishedAt)}
                {a.expiresAt && ` · ${a.expired ? 'expired' : 'until'} ${formatDateTime(a.expiresAt)}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.pinned && <Badge tone="primary"><Pin className="h-3 w-3" /> Pinned</Badge>}
                {a.sendEmail && <Badge tone="outline"><Mail className="h-3 w-3" /> Emailed</Badge>}
                {a.audience !== 'COMPANY' && <Badge tone="outline"><Users className="h-3 w-3" /> {a.audience === 'DEPARTMENTS' ? 'Selected departments' : 'Selected locations'}</Badge>}
              </div>
            </div>
          </div>
          {a.canEdit && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(true)} aria-label="Delete"><Trash2 /></Button>
            </div>
          )}
        </div>
        <div className="mt-5 whitespace-pre-line text-[15px] leading-relaxed">{a.body}</div>
        {a.attachmentName && (
          <Button variant="secondary" size="sm" className="mt-5" onClick={download} loading={downloading}>
            <Download /> {a.attachmentName}
          </Button>
        )}
        {a.requiresAck && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-subtle/60 px-4 py-3">
            {a.acknowledgedAt ? (
              <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> You confirmed this {formatRelative(a.acknowledgedAt)}</p>
            ) : (
              <>
                <p className="text-sm">Please confirm you have read and understood this.</p>
                <Button onClick={confirm} loading={ack.isPending}><CheckCircle2 /> I have read this</Button>
              </>
            )}
          </div>
        )}
      </Card>

      {a.canEdit && <ReadReport id={a.id} stats={a.stats ?? null} requiresAck={a.requiresAck} />}

      {editing && <AnnouncementDialog value={a} onClose={() => setEditing(false)} onSaved={() => q.refetch()} />}
      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        isDanger
        isLoading={del.isPending}
        title="Delete this announcement?"
        description="It disappears for everyone."
        confirmText="Delete"
        onConfirm={async () => {
          try {
            await del.mutateAsync(a.id);
            toast.success('Announcement deleted');
            router.push('/app/announcements');
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete'));
          }
        }}
      />
    </div>
  );
}

/** Posters: who has read / confirmed. */
function ReadReport({ id, stats, requiresAck }: { id: string; stats: { audience: number; read: number; acknowledged: number } | null; requiresAck: boolean }) {
  const report = useAnnouncementReport(id);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const people = report.data?.people ?? [];
  const done = (p: (typeof people)[number]) => (requiresAck ? Boolean(p.acknowledgedAt) : Boolean(p.readAt));
  const shown = people.filter((p) => (tab === 'done' ? done(p) : !done(p)));
  const s = report.data ?? stats;
  return (
    <Card>
      <CardHeader
        icon={<Users />}
        title={requiresAck ? 'Confirmations' : 'Read by'}
        description={s ? `${'total' in s ? s.total : s.audience} people · ${s.read} read${requiresAck ? ` · ${s.acknowledged} confirmed` : ''}` : undefined}
      />
      <div className="px-5">
        <Tabs
          tabs={[
            { id: 'pending' as const, label: requiresAck ? 'Not confirmed yet' : 'Not read yet', count: people.filter((p) => !done(p)).length },
            { id: 'done' as const, label: requiresAck ? 'Confirmed' : 'Read', count: people.filter(done).length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {report.isLoading ? (
        <div className="p-5"><Skeleton className="h-24 w-full" /></div>
      ) : !shown.length ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">{tab === 'pending' ? 'Everyone is done. 🎉' : 'Nobody yet.'}</p>
      ) : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <PersonAvatar person={{ firstName: p.firstName, lastName: p.lastName, avatarUrl: p.employee?.avatarUrl ?? null }} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.firstName} {p.lastName}</p>
                <p className="truncate text-xs text-muted-foreground">{p.employee?.department?.name ?? p.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {p.acknowledgedAt ? `Confirmed ${formatRelative(p.acknowledgedAt)}` : p.readAt ? `Read ${formatRelative(p.readAt)}` : 'Not opened'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

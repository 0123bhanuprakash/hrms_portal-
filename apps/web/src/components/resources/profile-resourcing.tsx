'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRightLeft, Check, History, Pencil, RotateCcw, Sparkles, UserMinus, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { HISTORY_TEXT, useAssignmentHistory, useSetSkills, useSkillSuggestions, type HistoryEntry } from '@/lib/company/resources';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TagInput } from './parts';
import { RequestPersonDialog } from './dialogs';

/**
 * Profile → Projects tab: skills (the person keeps them; HR can too) and the
 * assignment history (requested, assigned, reassigned, released — who and when).
 */
export function ProfileResourcing({ employeeId, canEditSkills }: { employeeId: string; canEditSkills: boolean }) {
  const q = useAssignmentHistory(employeeId);
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!q.data) return null; // not theirs to see
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <SkillsCard employeeId={employeeId} skills={q.data.skills} canEdit={canEditSkills} />
      <HistoryCard entries={q.data.data} requestBackFrom={q.data.requestBackFrom} employeeId={employeeId} person={q.data.person} />
    </div>
  );
}

function SkillsCard({ employeeId, skills, canEdit }: { employeeId: string; skills: string[]; canEdit: boolean }) {
  const save = useSetSkills();
  const suggestions = useSkillSuggestions(canEdit);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(skills);
  return (
    <Card>
      <CardHeader icon={<Sparkles />} title="Skills" description="Matched against resource requests and project tech stacks" action={canEdit && !editing && <Button size="sm" variant="ghost" onClick={() => { setValue(skills); setEditing(true); }}><Pencil /> Edit</Button>} />
      <div className="px-5 pb-5">
        {editing ? (
          <div className="space-y-2">
            <TagInput value={value} onChange={setValue} suggestions={suggestions.data ?? []} placeholder="e.g. React, Figma, AWS" max={40} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" loading={save.isPending} onClick={() => save.mutate({ employeeId, skills: value }, { onSuccess: () => { toast.success('Skills saved'); setEditing(false); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')) })}><Check /> Save</Button>
            </div>
          </div>
        ) : skills.length ? (
          <div className="flex flex-wrap gap-1.5">{skills.map((s) => <Badge key={s} tone="primary">{s}</Badge>)}</div>
        ) : (
          <p className="text-sm text-muted-foreground">None listed yet.{canEdit ? ' Add them so the right projects find you.' : ''}</p>
        )}
      </div>
    </Card>
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

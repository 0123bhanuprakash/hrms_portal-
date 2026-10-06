'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Crown, Palmtree, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useHelpdeskTeams, useSaveTeam, type HelpdeskTeam, type TeamMember } from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { PersonSelect } from '@/components/ui/pickers';

const TEAM_EMOJI: Record<HelpdeskTeam['queue'], string> = { IT: '💻', HR: '🧑‍💼', FINANCE: '💰', DEVOPS: '🚀' };

/**
 * Ticket topics → Teams & heads. Each team has one head who gets new tickets
 * and assigns them to people in the team; a backup covers leave days.
 * Company Admins choose; everyone else sees their own teams.
 */
export function TeamsPanel() {
  const q = useHelpdeskTeams();
  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (!q.data?.teams.length) return <EmptyState icon={<Users />} title="No teams" description="You don’t work any helpdesk queue." />;
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        With a head set, new tickets go to the head, who assigns them. People in the team work the tickets assigned to them and can add internal notes on any ticket. Without a head, anyone in the team takes tickets.
        {!q.data.canManage && ' Only a Company Admin chooses the head.'}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {q.data.teams.map((t) => <TeamCard key={t.queue} team={t} canManage={q.data!.canManage} />)}
      </div>
    </div>
  );
}

function TeamCard({ team, canManage }: { team: HelpdeskTeam; canManage: boolean }) {
  const save = useSaveTeam();
  const [editing, setEditing] = useState(false);
  const [headId, setHeadId] = useState(team.headId ?? '');
  const [backupId, setBackupId] = useState(team.backupId ?? '');
  const byId = new Map(team.members.map((m) => [m.id, m]));
  const head = team.headId ? byId.get(team.headId) : undefined;
  const backup = team.backupId ? byId.get(team.backupId) : undefined;
  const others = team.members.filter((m) => m.id !== team.headId && m.inQueue);
  const choices = team.members.filter((m) => m.inQueue && m.active);

  const submit = async () => {
    try {
      await save.mutateAsync({ queue: team.queue, headId: headId || null, backupId: headId && backupId ? backupId : null });
      toast.success(headId ? `${team.label} head saved` : `${team.label} has no head now — anyone in the team takes tickets`);
      setEditing(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="text-lg" aria-hidden>{TEAM_EMOJI[team.queue]}</span>
        <h2 className="text-sm font-semibold">{team.label}</h2>
        {team.unassigned > 0 && <Badge tone="warning">{team.unassigned} to assign</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{team.members.filter((m) => m.inQueue).length} people</span>
        {canManage && !editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>{team.headId ? 'Change' : 'Choose head'}</Button>}
      </div>

      {editing ? (
        <div className="space-y-3 px-5 py-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Head</span>
            <PersonSelect aria-label="Head" value={headId} onChange={(v) => { setHeadId(v); if (v === backupId) setBackupId(''); }} emptyLabel="No head — anyone in the team takes tickets" people={choices} />
          </label>
          <label className={cn('block space-y-1 text-sm', !headId && 'opacity-50')}>
            <span className="font-medium">Backup <span className="font-normal text-muted-foreground">· assigns too, and gets the alerts while the head is on leave</span></span>
            <PersonSelect aria-label="Backup" value={backupId} disabled={!headId} onChange={setBackupId} emptyLabel="No backup" people={choices.filter((m) => m.id !== headId)} />
          </label>
          {!choices.length && <p className="text-xs text-muted-foreground">Nobody works this queue yet. Give someone the “Work the {team.label} queue” permission in Roles first.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setEditing(false); setHeadId(team.headId ?? ''); setBackupId(team.backupId ?? ''); }} disabled={save.isPending}>Cancel</Button>
            <Button onClick={submit} loading={save.isPending}>Save</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 px-5 py-4">
          {head ? (
            <Person m={head} role={<Badge tone="warning" className="gap-1"><Crown className="h-3 w-3" /> Head</Badge>} note={`gets every new ${team.label} ticket`} load />
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> No head — anyone in the team takes tickets.</p>
          )}
          {others.map((m) => (
            <div key={m.id} className={cn(head && 'ml-4 border-l-2 border-border pl-4')}>
              <Person m={m} role={m.id === team.backupId ? <Badge tone="info">Backup</Badge> : null} load />
            </div>
          ))}
          {!others.length && head && <p className="ml-4 border-l-2 border-border pl-4 text-xs text-muted-foreground">Nobody else in the team yet — {head.firstName} handles every ticket.</p>}
          {backup && !backup.inQueue && <p className="text-xs text-warning">{backup.firstName} no longer works this queue — choose another backup.</p>}
        </div>
      )}
    </Card>
  );
}

function Person({ m, role, note, load }: { m: TeamMember; role: React.ReactNode; note?: string; load?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <PersonAvatar person={m} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className={cn('font-medium', !m.active && 'line-through opacity-60')}>{m.firstName} {m.lastName}</span>
          {role}
          {m.awayToday && <Badge tone="neutral" className="gap-1"><Palmtree className="h-3 w-3" /> On leave today</Badge>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{[m.designation, note].filter(Boolean).join(' · ')}</p>
      </div>
      {load && (
        <div className="flex w-28 items-center gap-2" title={`${m.open} open ticket${m.open === 1 ? '' : 's'}`}>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className={cn('block h-full rounded-full', m.open > 6 ? 'bg-warning' : 'bg-success')} style={{ width: `${Math.min(100, (m.open / 8) * 100)}%` }} />
          </span>
          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{m.open} open</span>
        </div>
      )}
    </div>
  );
}

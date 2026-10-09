'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Crown, Palmtree, Pencil, Plus, ShieldCheck, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { PersonSearch, type PickPerson } from '@/components/people/person-search';
import { useCreateTeam, useHelpdeskTeams, useSaveTeam, type HelpdeskTeam, type TeamMember } from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { PersonSelect } from '@/components/ui/pickers';

const TEAM_EMOJIS = ['🏢', '🧹', '🛋️', '🅿️', '🍽️', '🚚', '📦', '🛡️', '⚖️', '📣', '🎓', '🧪', '🏗️', '🔧', '🌐', '📞', '🧾', '🩺', '✈️', '🎫'];

/**
 * Ticket topics → Teams. IT, HR, Finance and DevOps are built in (who works
 * them comes from roles). People who manage helpdesk teams add their own teams
 * and pick who works them. Each team can have a head who gets new tickets and
 * assigns them; a backup covers leave days.
 */
export function TeamsPanel() {
  const q = useHelpdeskTeams();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  const teams = q.data?.teams ?? [];
  const canManage = Boolean(q.data?.canManage);
  const live = teams.filter((t) => !t.archived);
  const archived = teams.filter((t) => t.archived);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <p className="max-w-3xl flex-1 text-sm text-muted-foreground">
          With a head set, new tickets go to the head, who assigns them. People in the team work the tickets assigned to them and can add internal notes on any ticket. Without a head, anyone in the team takes tickets.
          {!canManage && ' Only people who manage helpdesk teams choose heads and add teams.'}
        </p>
        {canManage && <Button onClick={() => setCreating(true)}><Plus /> New team</Button>}
      </div>
      {!live.length && <EmptyState icon={<Users />} title="No teams" description="You don’t work any helpdesk team." />}
      <div className="grid gap-4 lg:grid-cols-2">
        {live.map((t) => <TeamCard key={t.queue} team={t} canManage={canManage} />)}
      </div>
      {archived.length > 0 && (
        <div className="space-y-3">
          <button type="button" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? 'Hide' : 'Show'} {archived.length} archived team{archived.length === 1 ? '' : 's'}
          </button>
          {showArchived && <div className="grid gap-4 lg:grid-cols-2">{archived.map((t) => <TeamCard key={t.queue} team={t} canManage={canManage} />)}</div>}
        </div>
      )}
      {creating && <TeamDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function TeamCard({ team, canManage }: { team: HelpdeskTeam; canManage: boolean }) {
  const save = useSaveTeam();
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [headId, setHeadId] = useState(team.headId ?? '');
  const [backupId, setBackupId] = useState(team.backupId ?? '');
  const byId = new Map(team.members.map((m) => [m.id, m]));
  const head = team.headId ? byId.get(team.headId) : undefined;
  const backup = team.backupId ? byId.get(team.backupId) : undefined;
  const others = team.members.filter((m) => m.id !== team.headId && m.inQueue);
  const choices = team.members.filter((m) => m.inQueue && m.active);
  const people = team.members.filter((m) => m.inQueue).length;

  const submit = async () => {
    try {
      await save.mutateAsync({ queue: team.queue, headId: headId || null, backupId: headId && backupId ? backupId : null });
      toast.success(headId ? `${team.label} head saved` : `${team.label} has no head now — anyone in the team takes tickets`);
      setEditing(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  const restore = async () => {
    try {
      await save.mutateAsync({ queue: team.queue, archived: false });
      toast.success(`${team.label} takes tickets again`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not restore the team'));
    }
  };

  return (
    <Card className={cn('overflow-hidden', team.archived && 'opacity-75')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <span className="text-lg" aria-hidden>{team.emoji}</span>
        <h2 className="text-sm font-semibold">{team.label}</h2>
        {!team.custom && <Badge tone="neutral">Built in</Badge>}
        {team.archived && <Badge tone="neutral">Archived</Badge>}
        {team.unassigned > 0 && <Badge tone="warning">{team.unassigned} to assign</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{people} {people === 1 ? 'person' : 'people'}</span>
        {canManage && team.custom && !editing && (
          team.archived
            ? <Button size="sm" variant="secondary" loading={save.isPending} onClick={() => void restore()}><ArchiveRestore /> Restore</Button>
            : <Button size="sm" variant="ghost" onClick={() => setDetails(true)}><Pencil /> Edit</Button>
        )}
        {canManage && !team.archived && !editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>{team.headId ? 'Change head' : 'Choose head'}</Button>}
      </div>
      {team.description && <p className="border-b border-border px-5 py-2 text-xs text-muted-foreground">{team.description}</p>}

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
          {!choices.length && (
            <p className="text-xs text-muted-foreground">
              {team.custom ? 'Nobody is in this team yet — add members with Edit first.' : `Nobody works this team yet. Give someone the “Work the ${team.label} queue” permission in Roles first.`}
            </p>
          )}
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
          {!others.length && !head && team.custom && <p className="text-xs text-muted-foreground">No members yet — nobody will see this team’s tickets until you add people.</p>}
          {backup && !backup.inQueue && <p className="text-xs text-warning">{backup.firstName} no longer works this team — choose another backup.</p>}
        </div>
      )}
      {details && <TeamDialog team={team} onClose={() => setDetails(false)} onArchive={() => { setDetails(false); setArchiving(true); }} />}
      {archiving && <ArchiveDialog team={team} onClose={() => setArchiving(false)} />}
    </Card>
  );
}

/** New team, or name / emoji / description / members of a company-made one. */
function TeamDialog({ team, onClose, onArchive }: { team?: HelpdeskTeam; onClose: () => void; onArchive?: () => void }) {
  const create = useCreateTeam();
  const save = useSaveTeam();
  const busy = create.isPending || save.isPending;
  const [label, setLabel] = useState(team?.label ?? '');
  const [emoji, setEmoji] = useState(team?.emoji ?? '🏢');
  const [description, setDescription] = useState(team?.description ?? '');
  // Members by user id, with what's needed to show them
  const [members, setMembers] = useState<Array<Pick<TeamMember, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> & { sub?: string | null }>>(
    () => (team?.members ?? []).filter((m) => m.inQueue || m.active).map((m) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, avatarUrl: m.avatarUrl, sub: m.designation })),
  );
  const add = (id: string, p: PickPerson | null) => {
    if (!id || !p || members.some((m) => m.id === id)) return;
    setMembers([...members, { id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, sub: p.designation?.name ?? null }]);
  };
  const leaving = team ? team.members.filter((m) => (m.id === team.headId || m.id === team.backupId) && !members.some((x) => x.id === m.id)) : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { label: label.trim(), emoji: emoji || null, description: description.trim() || null, memberIds: members.map((m) => m.id) };
    try {
      if (team) await save.mutateAsync({ queue: team.queue, ...body });
      else await create.mutateAsync(body);
      toast.success(team ? `${body.label} saved` : `${body.label} team added — employees can raise tickets to it now`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the team'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={<Users />}
      title={team ? `Edit ${team.label}` : 'New helpdesk team'}
      description={team ? 'Changes show for everyone straight away.' : 'Employees see it next to IT, HR, Finance and DevOps when they raise a ticket.'}
      size="md"
      footer={
        <>
          {team && onArchive && <Button variant="ghost" className="mr-auto text-destructive" onClick={onArchive} disabled={busy}><Archive /> Archive</Button>}
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="team-form" loading={busy} disabled={label.trim().length < 2}>{team ? 'Save' : 'Add team'}</Button>
        </>
      }
    >
      <form id="team-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="team-name" required>
          <Input id="team-name" value={label} onChange={(e) => setLabel(e.target.value)} required minLength={2} maxLength={40} placeholder="e.g. Facilities, Legal, Admin" autoFocus />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">Emoji</p>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Emoji">
            {TEAM_EMOJIS.map((i) => (
              <button key={i} type="button" role="radio" aria-checked={emoji === i} onClick={() => setEmoji(i)} className={cn('flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors', emoji === i ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-subtle')}>{i}</button>
            ))}
          </div>
        </div>
        <Field label="What it helps with" htmlFor="team-desc" hint="One line on “Raise a ticket”, so people pick the right team.">
          <Input id="team-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="e.g. Desks, AC, parking, pantry" />
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-medium">Members <span className="font-normal text-muted-foreground">· they see and work this team’s tickets</span></p>
          <PersonSearch by="user" aria-label="Add a member" value="" onChange={add} placeholder="Add a person…" hide={members.map((m) => m.id)} />
          {members.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <li key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-1.5 text-sm">
                  <PersonAvatar person={m} size="xs" />
                  {m.firstName} {m.lastName}
                  <button type="button" aria-label={`Remove ${m.firstName}`} onClick={() => setMembers(members.filter((x) => x.id !== m.id))} className="rounded-full p-0.5 text-muted-foreground hover:bg-subtle hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No members yet. You can add them later, but nobody sees the team’s tickets until you do.</p>
          )}
          {leaving.length > 0 && <p className="text-xs text-warning">{leaving.map((m) => m.firstName).join(' and ')} will also stop being head / backup.</p>}
        </div>
      </form>
    </Modal>
  );
}

/** Archive: no new tickets; open ones can still be finished. Asks again when tickets are open. */
function ArchiveDialog({ team, onClose }: { team: HelpdeskTeam; onClose: () => void }) {
  const save = useSaveTeam();
  const [openCount, setOpenCount] = useState<string | null>(null);
  const run = async (force: boolean) => {
    try {
      await save.mutateAsync({ queue: team.queue, archived: true, force });
      toast.success(`${team.label} archived`);
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Could not archive the team');
      if (!force && (err as { response?: { status?: number } })?.response?.status === 409) setOpenCount(msg);
      else toast.error(msg);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Archive />}
      tone="danger"
      title={`Archive ${team.label}?`}
      description="Employees can’t raise new tickets to it. Its topics stay, and you can restore it any time."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button variant="danger" loading={save.isPending} onClick={() => void run(Boolean(openCount))}>{openCount ? 'Archive anyway' : 'Archive'}</Button>
        </>
      }
    >
      {openCount && <p className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">{openCount}</p>}
    </Modal>
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

'use client';

import React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  DoorOpen,
  FolderKanban,
  GraduationCap,
  Heart,
  Mail,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plane,
  RotateCcw,
  Timer,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { AvatarEditor } from '@/components/profile/avatar-editor';
import { IdBadge } from '@/components/profile/profile-header';
import { StatusPill, tintFor } from '@/components/people/photo-card';
import { usePersonCard, type EmployeeRecord } from '@/lib/company/profile';
import { exitReasonLabel, useBulkEmployees, useEmployeeGlance, useEmployeeHistory, type Glance, type HistoryItem } from '@/lib/company/lifecycle';
import type { EmployeeStage } from '@/lib/company/org';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { StagePill, internshipText, isCurrentIntern, type LifecycleAction } from './lifecycle-ui';

/** Stage from the record (the API has already hidden what this viewer may not see). */
export function stageOfRecord(e: Pick<EmployeeRecord, 'employmentStatus' | 'joiningDate'>): EmployeeStage {
  if (e.employmentStatus === 'TERMINATED') return 'left';
  if (e.employmentStatus === 'NOTICE_PERIOD') return 'notice';
  if (e.joiningDate.slice(0, 10) > new Date().toISOString().slice(0, 10)) return 'joining';
  if (e.employmentStatus === 'PROBATION') return 'probation';
  return 'active';
}

export interface HeroPermissions {
  canEditPhoto: boolean;
  canEdit: boolean;
  canEditOthers: boolean;
  seesExits: boolean;
  isSelf: boolean;
}

/** Cover, big photo, stage + today, the next step as a button, and five numbers at a glance. */
export function EmployeeHero({ e, perms, onAction, onEdit, onChecklist }: { e: EmployeeRecord & { exitReason?: string | null }; perms: HeroPermissions; onAction: (a: LifecycleAction) => void; onEdit: () => void; onChecklist: (kind: 'joining' | 'exit') => void }) {
  const stage = stageOfRecord(e);
  const card = usePersonCard(stage === 'left' ? null : e.id);
  const glance = useEmployeeGlance(e.id);
  const person = { ...e, stage };
  const others = !perms.isSelf;

  const intern = isCurrentIntern(person) && stage !== 'joining';
  const internLine = internshipText(person);
  const primary: React.ReactNode =
    others && perms.canEditOthers && intern ? (
      <>
        <Button onClick={() => onAction('convert')}><GraduationCap /> Convert to employee</Button>
        <Button variant="secondary" onClick={() => onAction('extend-internship')}><CalendarClock /> Extend</Button>
      </>
    ) : others && perms.canEditOthers && stage === 'probation' ? (
      <>
        <Button onClick={() => onAction('confirm')}><UserCheck /> Confirm probation</Button>
        <Button variant="secondary" onClick={() => onAction('extend')}><CalendarClock /> Extend</Button>
      </>
    ) : others && perms.seesExits && stage === 'notice' ? (
      <Button variant="secondary" onClick={() => onChecklist('exit')}><ClipboardList /> Exit checklist</Button>
    ) : others && perms.canEditOthers && stage === 'joining' ? (
      <Button variant="secondary" onClick={() => onChecklist('joining')}><ClipboardList /> Joining checklist</Button>
    ) : null;

  const menu: Array<MenuItem | 'separator'> = [];
  if (perms.canEdit) menu.push({ label: 'Edit details', icon: <Pencil />, onSelect: onEdit });
  if (stage !== 'left' && !perms.isSelf) menu.push({ label: 'Give a shout-out', icon: <Heart />, onSelect: () => { window.location.href = `/app/kudos?to=${e.id}`; } });
  if (others && perms.seesExits && intern) menu.push('separator', { label: 'End internship', icon: <DoorOpen />, danger: true, onSelect: () => onAction('end-internship') });
  else if (others && perms.seesExits && (stage === 'active' || stage === 'probation')) menu.push('separator', { label: 'Start notice period', icon: <DoorOpen />, danger: true, onSelect: () => onAction('notice') });
  if (others && perms.seesExits && stage === 'notice') {
    menu.push('separator', { label: 'Withdraw notice', icon: <RotateCcw />, onSelect: () => onAction('withdraw') }, { label: 'Mark as left', icon: <DoorOpen />, danger: true, onSelect: () => onAction('left') });
  }

  return (
    <Card className="overflow-hidden">
      <div className={cn('relative h-24 bg-gradient-to-r opacity-90 sm:h-28', tintFor(e.department?.id))}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_-20%,rgba(255,255,255,.35),transparent_55%)]" />
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-end justify-between gap-3">
          <div className="-mt-12 shrink-0 rounded-[22px] border-4 border-surface bg-surface shadow-dialog">
            <AvatarEditor employeeId={e.id} person={e} canEdit={perms.canEditPhoto} avatarClassName="h-24 w-24 rounded-2xl text-2xl" />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-3">
            {primary}
            {menu.length > 0 && (
              <DropdownMenu label="More actions" items={menu} trigger={() => <Button variant="secondary" size="icon" aria-label="More actions"><MoreHorizontal /></Button>} />
            )}
          </div>
        </div>
        <div className="mt-3 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{e.firstName} {e.lastName}</h1>
              {stage !== 'active' && <StagePill person={person} />}
              {internLine && (
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', internLine.overdue ? 'bg-destructive-soft text-destructive' : 'bg-info-soft text-info')}>
                  <GraduationCap className="h-3 w-3" />
                  {internLine.text}
                </span>
              )}
              {card.data && <StatusPill today={card.data.today} className="shadow-none ring-1 ring-border" />}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[e.designation?.name, e.department?.name, e.employeeId].filter(Boolean).join(' · ')}
              {e.reportingManager && (
                <>
                  {' · reports to '}
                  <Link href={`/app/employees/${e.reportingManager.id}`} className="font-medium text-foreground hover:underline">{e.reportingManager.firstName} {e.reportingManager.lastName}</Link>
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground [&_svg]:size-3.5">
              <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail /> {e.email}</a>
              {e.location && <span className="inline-flex items-center gap-1.5"><MapPin /> {e.location.name}</span>}
              <span className="inline-flex items-center gap-1.5"><CalendarDays /> {stage === 'joining' ? 'Joins' : 'Joined'} {formatDate(e.joiningDate)}</span>
              {stage === 'left' && e.terminationDate && <span className="inline-flex items-center gap-1.5"><DoorOpen /> Left {formatDate(e.terminationDate)}{exitReasonLabel(e.exitReason) ? ` · ${exitReasonLabel(e.exitReason)}` : ''}</span>}
              {stage === 'notice' && e.exitReason && <span className="inline-flex items-center gap-1.5"><DoorOpen /> {exitReasonLabel(e.exitReason)}</span>}
            </div>
          </div>
          <div className="hidden xl:block"><IdBadge person={e} /></div>
        </div>
      </div>
      <GlanceRow glance={glance.data} loading={glance.isLoading} />
    </Card>
  );
}

function GlanceRow({ glance, loading }: { glance?: Glance; loading: boolean }) {
  if (loading) return <div className="border-t border-border p-4"><Skeleton className="h-12" /></div>;
  if (!glance) return null;
  const cells: Array<{ icon: React.ReactNode; label: string; value: string; sub: string }> = [];
  if (glance.leave) cells.push({ icon: <Plane />, label: 'Leave left', value: `${glance.leave.days} day${glance.leave.days === 1 ? '' : 's'}`, sub: glance.leave.items.slice(0, 2).map((i) => `${i.name} ${i.days}`).join(' · ') || 'No balances yet' });
  if (glance.attendance) cells.push({ icon: <Timer />, label: 'Attendance · this month', value: glance.attendance.pct === null ? '—' : `${glance.attendance.pct}%`, sub: `${glance.attendance.present} of ${glance.attendance.workdays} days${glance.attendance.late ? ` · ${glance.attendance.late} late` : ''}` });
  if (glance.projects) cells.push({ icon: <FolderKanban />, label: 'Projects', value: String(glance.projects.count), sub: glance.projects.items.slice(0, 2).map((p) => `${p.name} ${p.allocation}%`).join(' · ') || 'None right now' });
  if (glance.assets) cells.push({ icon: <PackageCheck />, label: 'Assets', value: String(glance.assets.count), sub: glance.assets.items.slice(0, 2).join(' · ') || 'Nothing assigned' });
  if (glance.completion) cells.push({ icon: <UserRound />, label: 'Profile', value: `${glance.completion.percent}%`, sub: glance.completion.percent === 100 ? 'Complete' : `${glance.completion.items.filter((i) => !i.done).length} things missing` });
  if (!cells.length) return null;
  return (
    <div className={cn('grid border-t border-border', cells.length >= 5 ? 'grid-cols-2 md:grid-cols-5' : cells.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3')}>
      {cells.map((c) => (
        <div key={c.label} className="min-w-0 border-b border-r border-border px-4 py-3 last:border-r-0 md:border-b-0 [&_svg]:size-3.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{c.icon}{c.label}</p>
          <p className="text-lg font-semibold tabular-nums">{c.value}</p>
          <p className="truncate text-xs text-muted-foreground" title={c.sub}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Employment history ─────────────────────────────────────

const KIND_STYLE: Record<string, string> = {
  joined: 'bg-primary-soft text-primary',
  manager: 'bg-info-soft text-info',
  department: 'bg-info-soft text-info',
  title: 'bg-info-soft text-info',
  location: 'bg-info-soft text-info',
  type: 'bg-muted text-muted-foreground',
  status: 'bg-muted text-muted-foreground',
  confirmed: 'bg-success-soft text-success',
  probation_extended: 'bg-warning-soft text-warning',
  notice: 'bg-destructive-soft text-destructive',
  notice_withdrawn: 'bg-success-soft text-success',
  left: 'bg-muted text-muted-foreground',
  upcoming: 'bg-warning-soft text-warning',
};

export function EmploymentHistory({ employeeId }: { employeeId: string }) {
  const history = useEmployeeHistory(employeeId);
  return (
    <Card>
      <CardHeader icon={<CalendarClock />} title="Employment history" description="Every change to their job, with who made it" />
      <div className="px-5 pb-5">
        {history.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : history.isLoadingError ? (
          <p className="text-sm text-muted-foreground">{getApiErrorMessage(history.error, 'Could not load the history')}</p>
        ) : (
          <ol className="relative">
            {(history.data ?? []).map((h, i, all) => <HistoryRow key={h.id} h={h} last={i === all.length - 1} />)}
          </ol>
        )}
        {history.data && history.data.length <= 2 && (
          <p className="mt-2 text-xs text-muted-foreground">Changes made from now on (manager, team, title, office, probation, notice) appear here.</p>
        )}
      </div>
    </Card>
  );
}

function HistoryRow({ h, last }: { h: HistoryItem; last: boolean }) {
  return (
    <li className={cn('relative flex gap-3 pb-4', h.upcoming && 'opacity-80')}>
      {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />}
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface [&_svg]:size-3.5', KIND_STYLE[h.kind] ?? 'bg-muted text-muted-foreground', h.upcoming && 'border border-dashed border-warning')}>
        {h.kind === 'confirmed' ? <CheckCircle2 /> : h.kind === 'joined' ? <UserRound /> : h.kind === 'notice' || h.kind === 'left' ? <DoorOpen /> : h.upcoming ? <CalendarClock /> : <Circle />}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold">{h.title}</p>
        {h.detail && <p className="text-xs text-muted-foreground">{h.detail}</p>}
        {h.note && <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs italic text-muted-foreground">“{h.note}”</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {h.upcoming ? (h.effectiveOn ? formatDate(h.effectiveOn) : 'Coming up') : h.kind === 'joined' && h.effectiveOn ? formatDate(h.effectiveOn) : `${formatDate(h.at)} · ${formatRelative(h.at)}`}
          {h.by ? ` · by ${h.by}` : ''}
          {!h.upcoming && h.effectiveOn && h.kind !== 'joined' && h.kind !== 'confirmed' ? ` · from ${formatDate(h.effectiveOn)}` : ''}
        </p>
      </div>
    </li>
  );
}

// ─── Profile checklist (what HR still needs) ────────────────

export function ProfileChecklist({ employeeId, firstName, canRemind }: { employeeId: string; firstName: string; canRemind: boolean }) {
  const glance = useEmployeeGlance(employeeId);
  const remind = useBulkEmployees();
  const c = glance.data?.completion;
  if (!c) return null;
  return (
    <Card>
      <CardHeader icon={<UserRound />} title={`Profile · ${c.percent}%`} description={c.percent === 100 ? 'Everything HR and payroll need' : `${firstName} can fill these in from My profile`} />
      <div className="space-y-3 px-5 pb-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${c.percent}%` }} /></div>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {c.items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 text-sm">
              {i.done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-warning" />}
              <span className={i.done ? 'text-muted-foreground' : 'font-medium'}>{i.label}</span>
            </li>
          ))}
        </ul>
        {canRemind && c.percent < 100 && (
          <Button
            variant="secondary"
            size="sm"
            loading={remind.isPending}
            onClick={() =>
              remind.mutate({ ids: [employeeId], action: 'remind' }, {
                onSuccess: (r) => (r.updated ? toast.success(`Reminder sent to ${firstName}`) : toast.info(r.skipped[0]?.reason ?? 'Nothing to send')),
                onError: (e) => toast.error(getApiErrorMessage(e, 'Could not send the reminder')),
              })
            }
          >
            <Mail /> Send reminder
          </Button>
        )}
      </div>
    </Card>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { STAGES, exitReasonLabel, useEmployeeBoard, type BoardPerson } from '@/lib/company/lifecycle';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { ProfileMeter, internshipText, stageText, type LifecycleAction } from './lifecycle-ui';

export interface BoardHandlers {
  canEditOthers: boolean;
  seesExits: boolean;
  onAction: (action: LifecycleAction, person: BoardPerson) => void;
  onChecklist: (person: BoardPerson, kind: 'joining' | 'exit') => void;
}

/** Joining soon → Probation → Active → Notice → Left, with the next step on each card. */
export function EmployeeBoard({ canEditOthers, seesExits, onAction, onChecklist }: BoardHandlers) {
  const board = useEmployeeBoard();
  if (board.isLoadingError) return <ErrorState message={getApiErrorMessage(board.error, 'Could not load the board')} onRetry={() => board.refetch()} />;
  if (board.isLoading || !board.data) {
    return <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}</div>;
  }
  const lanes = board.data.lanes;

  return (
    <div className={cn('grid items-start gap-3 md:grid-cols-3', lanes.length === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-3')}>
      {lanes.map((lane) => {
        const meta = STAGES.find((s) => s.id === lane.stage)!;
        return (
          <section key={lane.stage} className="flex min-h-[18rem] flex-col gap-2 rounded-xl bg-muted/60 p-2.5" aria-label={meta.label}>
            <h3 className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className={cn('h-2 w-2 rounded-full', meta.dot)} />{lane.stage === 'left' ? 'Left · 90 days' : meta.label}</span>
              <span className="tabular-nums">{lane.total}</span>
            </h3>
            {!lane.people.length && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nobody here</p>}
            {lane.people.map((p) => (
              <article key={p.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-card transition-shadow hover:shadow-md">
                <Link href={`/app/employees/${p.id}`} className="flex items-center gap-2.5 rounded-md hover:opacity-90">
                  <PersonAvatar person={p} size="md" className="rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.firstName} {p.lastName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.designation?.name ?? p.department?.name ?? '—'}</span>
                  </span>
                </Link>
                <p className={cn('text-xs font-semibold', lane.stage === 'probation' ? 'text-warning' : lane.stage === 'notice' ? 'text-destructive' : lane.stage === 'joining' ? 'text-primary' : 'text-muted-foreground')}>
                  {stageText(p)}
                  {lane.stage === 'left' && exitReasonLabel(p.exitReason) ? ` · ${exitReasonLabel(p.exitReason)}` : ''}
                </p>
                {(() => {
                  const intern = internshipText({ ...p, stage: lane.stage });
                  return intern && <p className={cn('-mt-1 text-xs', intern.overdue ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{intern.text}</p>;
                })()}
                {p.profilePercent !== null && p.profilePercent !== undefined && p.profilePercent < 100 && lane.stage !== 'left' && <ProfileMeter percent={p.profilePercent} />}
                <CardActions person={p} stage={lane.stage} canEditOthers={canEditOthers} seesExits={seesExits} onAction={onAction} onChecklist={onChecklist} />
              </article>
            ))}
            {lane.total > lane.people.length && (
              <Link href={`/app/employees?stage=${lane.stage}`} className="px-1 text-center text-xs font-medium text-primary hover:underline">
                +{lane.total - lane.people.length} more in the table
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CardActions({ person, stage, canEditOthers, seesExits, onAction, onChecklist }: { person: BoardPerson; stage: string } & BoardHandlers) {
  const btn = 'flex-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors';
  if (canEditOthers && person.employmentType === 'INTERN' && (stage === 'active' || stage === 'probation')) {
    return (
      <div className="flex gap-1.5">
        <button type="button" className={cn(btn, 'border-primary bg-primary text-primary-foreground hover:bg-primary/90')} onClick={() => onAction('convert', person)}>Convert</button>
        <button type="button" className={cn(btn, 'border-border hover:bg-subtle')} onClick={() => onAction('extend-internship', person)}>Extend</button>
      </div>
    );
  }
  if (stage === 'probation' && canEditOthers) {
    return (
      <div className="flex gap-1.5">
        <button type="button" className={cn(btn, 'border-primary bg-primary text-primary-foreground hover:bg-primary/90')} onClick={() => onAction('confirm', person)}>Confirm</button>
        <button type="button" className={cn(btn, 'border-border hover:bg-subtle')} onClick={() => onAction('extend', person)}>Extend</button>
      </div>
    );
  }
  if ((stage === 'joining' && canEditOthers) || (stage === 'notice' && seesExits)) {
    const c = person.checklist;
    return (
      <button type="button" className={cn(btn, 'flex items-center justify-center gap-1.5 border-border hover:bg-subtle')} onClick={() => onChecklist(person, stage === 'joining' ? 'joining' : 'exit')}>
        <ClipboardList className="h-3.5 w-3.5" />
        {stage === 'joining' ? 'Joining' : 'Exit'} checklist{c ? ` ${c.done}/${c.total}` : ''}
      </button>
    );
  }
  return null;
}

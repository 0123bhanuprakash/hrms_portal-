'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Play, Square, Zap } from 'lucide-react';
import { Card } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { blockColor, GENERAL_COLOR } from '@/components/timesheets/week-calendar';
import { clock, dayLabel, fmtHours, useSaveBlock, type Week } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { Select } from '@/components/ui/pickers';

interface TimerState {
  projectId: string | null;
  description: string;
  startedAt: string;
}
const timerKey = (employeeId: string) => `ts-timer-${employeeId}`;
const readTimer = (employeeId: string): TimerState | null => {
  try {
    const raw = localStorage.getItem(timerKey(employeeId));
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
};
const writeTimer = (employeeId: string, t: TimerState | null) => {
  try {
    if (t) localStorage.setItem(timerKey(employeeId), JSON.stringify(t));
    else localStorage.removeItem(timerKey(employeeId));
  } catch {
    /* storage blocked — the timer just won't survive a reload */
  }
};
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Start a timer on a project; stopping it logs a block from start to now. */
export function TimerCard({ week, onNeedsEdit }: { week: Week; onNeedsEdit: (date: string, startMin: number, endMin: number, projectId: string | null, description: string) => void }) {
  const id = week.employee.id;
  const [t, setT] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [projectId, setProjectId] = useState<string | null>(week.projects[0]?.id ?? null);
  const [description, setDescription] = useState('');
  const save = useSaveBlock();
  useEffect(() => setT(readTimer(id)), [id]);
  useEffect(() => {
    if (!t) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [t]);

  const stop = async () => {
    if (!t) return;
    const started = new Date(t.startedAt);
    const end = new Date();
    const date = localKey(started);
    const startMin = Math.floor((started.getHours() * 60 + started.getMinutes()) / 5) * 5;
    const days = Math.round((new Date(`${localKey(end)}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000);
    const endMin = Math.max(startMin + 5, Math.floor((end.getHours() * 60 + end.getMinutes() + days * 1440) / 5) * 5);
    writeTimer(id, null);
    setT(null);
    try {
      await save.mutateAsync({ date, startMin, endMin, projectId: t.projectId, description: t.description || 'Timed work' });
      toast.success(`Logged ${fmtHours(endMin - startMin)}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not log it — adjust the times'));
      onNeedsEdit(date, startMin, endMin, t.projectId, t.description);
    }
  };

  if (!week.isOwn) return null;
  const project = week.projects.find((p) => p.id === (t ? t.projectId : projectId));
  const secs = t ? Math.max(0, Math.floor((now - new Date(t.startedAt).getTime()) / 1000)) : 0;
  const hhmm = `${String(Math.floor(secs / 3600)).padStart(2, '0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <Card className="space-y-2.5 bg-gradient-to-br from-primary-soft/60 to-transparent p-3">
      <div className="flex items-center justify-between text-xs"><b>Timer</b>{t && <span className="rounded-full bg-success/10 px-2 py-0.5 font-bold text-success">● running</span>}</div>
      {t ? (
        <>
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-1.5 rounded-full" style={{ background: project ? blockColor(project) : GENERAL_COLOR }} />
            <div className="min-w-0 flex-1"><b className="block truncate text-sm">{project?.name ?? 'General'}</b><span className="block truncate text-xs text-muted-foreground">{t.description || 'No description yet'}</span></div>
            <b className="text-lg tabular-nums">{hhmm}</b>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1" icon={<Square />} onClick={() => void stop()} loading={save.isPending}>Stop &amp; log</Button>
            <Button size="sm" variant="ghost" onClick={() => { writeTimer(id, null); setT(null); }}>Discard</Button>
          </div>
        </>
      ) : (
        <>
          <Select className="h-8 w-full rounded-md border border-input bg-surface px-2 text-xs" value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value || null)} aria-label="Timer project">
            {week.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="">General</option>
          </Select>
          <input className="h-8 w-full rounded-md border border-input bg-surface px-2 text-xs" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you working on?" maxLength={500} aria-label="Timer description" />
          <Button size="sm" variant="soft" className="w-full" icon={<Play />} onClick={() => { const n = { projectId, description, startedAt: new Date().toISOString() }; writeTimer(id, n); setT(n); }}>Start timer</Button>
        </>
      )}
    </Card>
  );
}

/** My projects this week: logged vs my share of the working hours. */
export function ProjectsCard({ week }: { week: Week }) {
  if (!week.isOwn) return null;
  return (
    <Card className="space-y-2 p-3">
      <b className="text-sm">Log against</b>
      <p className="text-xs text-muted-foreground">Your projects from the PMO — drag on the calendar to log.</p>
      {week.projects.map((p) => (
        <div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
          <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: blockColor(p) }} />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[13px]">{p.name}</b>
            <span className="block truncate text-[11px] text-muted-foreground">{p.billable ? 'Billable' : p.type === 'CLIENT' ? 'Not billed' : 'Investment'} · {p.allocation}%</span>
            {p.expectedMinutes > 0 && (
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (p.loggedMinutes / p.expectedMinutes) * 100)}%`, background: blockColor(p) }} /></span>
            )}
          </div>
          <span className="text-right text-xs"><b>{fmtHours(p.loggedMinutes)}</b>{p.expectedMinutes > 0 && <span className="block text-muted-foreground">of {fmtHours(p.expectedMinutes)}</span>}</span>
        </div>
      ))}
      <div className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
        <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: GENERAL_COLOR }} />
        <div className="min-w-0 flex-1"><b className="block text-[13px]">General</b><span className="block text-[11px] text-muted-foreground">Not on a project · investment</span></div>
        <b className="text-xs">{fmtHours(week.generalMinutes)}</b>
      </div>
    </Card>
  );
}

/** Time you were checked in but haven't logged (30 min or more). */
export function gapsOf(week: Week) {
  const out: Array<{ date: string; startMin: number; endMin: number }> = [];
  for (const d of week.days) {
    if (d.future || d.locked || !d.attendance?.checkIn) continue;
    const end = d.attendance.checkOut ?? (d.date === week.today ? week.nowMin : null);
    if (end == null) continue;
    let cur = Math.ceil(d.attendance.checkIn / 5) * 5;
    const blocks = week.blocks.filter((b) => b.date === d.date && b.startMin != null).sort((a, b) => a.startMin! - b.startMin!);
    for (const b of blocks) {
      if (b.startMin! - cur >= 30) out.push({ date: d.date, startMin: cur, endMin: b.startMin! });
      cur = Math.max(cur, b.endMin!);
    }
    const last = Math.floor(end / 5) * 5;
    if (last - cur >= 30) out.push({ date: d.date, startMin: cur, endMin: last });
  }
  return out;
}

export function GapsCard({ week, onFill }: { week: Week; onFill: (date: string, startMin: number, endMin: number) => void }) {
  if (!week.isOwn) return null;
  const gaps = gapsOf(week);
  if (!gaps.length) return null;
  return (
    <Card className="space-y-2 border-warning/40 bg-warning/5 p-3">
      <b className="flex items-center gap-1.5 text-sm"><Zap className="h-4 w-4 text-warning" /> Gaps to fill</b>
      {gaps.slice(0, 5).map((g) => (
        <div key={`${g.date}-${g.startMin}`} className="flex items-center gap-2 text-xs">
          <b className="w-12 shrink-0">{dayLabel(g.date)}</b>
          <span className="min-w-0 flex-1">{clock(g.startMin)} – {clock(g.endMin)}<span className="block text-muted-foreground">{fmtHours(g.endMin - g.startMin)} in office, not logged</span></span>
          <Button size="sm" variant="secondary" onClick={() => onFill(g.date, g.startMin, g.endMin)}>Fill</Button>
        </div>
      ))}
      {gaps.length > 5 && <p className="text-[11px] text-muted-foreground">+ {gaps.length - 5} more</p>}
      <p className="text-[11px] text-muted-foreground">From your check-in and check-out times</p>
    </Card>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Plus, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/feedback';
import { inputClass } from '@/components/ui/field';
import { api } from '@/lib/api';
import { addDays, dayLabel, fmtHours, parseHours, toHours, useRecallWeek, useSaveWeek, useSubmitWeek, type Week } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Row = { key: number; projectId: string; task: string; billable: boolean; cells: string[] };
let seq = 0;
const blankRow = (projectId = ''): Row => ({ key: ++seq, projectId, task: '', billable: Boolean(projectId), cells: ['', '', '', '', '', '', ''] });

/** The editable (or read-only) Monday–Sunday grid for one person's week. */
export function WeekGrid({ week }: { week: Week }) {
  const editable = week.canEdit;
  const save = useSaveWeek(week.weekStart);
  const submit = useSubmitWeek(week.weekStart);
  const recall = useRecallWeek(week.weekStart);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const fromWeek = week.lines.map((l) => ({ key: ++seq, projectId: l.projectId ?? '', task: l.task, billable: l.billable, cells: l.minutes.map(toHours) }));
    setRows(fromWeek.length ? fromWeek : editable ? [blankRow(week.projects[0]?.id ?? '')] : []);
    setDirty(false);
  }, [week, editable]);

  const minutes = (r: Row) => r.cells.map((c) => parseHours(c) ?? 0);
  const dayTotals = useMemo(() => week.days.map((_, i) => rows.reduce((n, r) => n + (parseHours(r.cells[i]!) ?? 0), 0)), [rows, week.days]);
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const invalid = rows.some((r) => r.cells.some((c) => parseHours(c) === null));
  const projectName = (id: string) => week.projects.find((p) => p.id === id)?.name;

  const update = (key: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const setCell = (key: number, i: number, v: string) => setRows((rs) => (setDirty(true), rs.map((r) => (r.key === key ? { ...r, cells: r.cells.map((c, j) => (j === i ? v : c)) } : r))));

  const doSave = async (quiet = false) => {
    const lines = rows
      .filter((r) => r.task.trim() || minutes(r).some(Boolean))
      .map((r) => ({ projectId: r.projectId || null, task: r.task.trim(), billable: Boolean(r.projectId) && r.billable, minutes: minutes(r) }));
    const missing = lines.find((l) => l.task.length < 2);
    if (missing) {
      toast.error('Every row needs a task (at least 2 characters)');
      return false;
    }
    try {
      await save.mutateAsync(lines);
      setDirty(false);
      if (!quiet) toast.success('Saved');
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
      return false;
    }
  };

  const doSubmit = async () => {
    if (dirty && !(await doSave(true))) return;
    try {
      const w = await submit.mutateAsync();
      toast.success(`Submitted to ${w.approval?.approvers.map((a) => a.firstName).join(', ') || 'HR'}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit'));
    }
  };

  const copyLastWeek = async () => {
    setCopying(true);
    try {
      const prev = (await api.get(`/timesheets/weeks/${addDays(week.weekStart, -7)}`)).data.data as Week;
      const usable = prev.lines.filter((l) => !l.projectId || week.projects.some((p) => p.id === l.projectId));
      if (!usable.length) toast.info('Nothing to copy from last week');
      else {
        setRows(usable.map((l) => ({ key: ++seq, projectId: l.projectId ?? '', task: l.task, billable: l.billable, cells: ['', '', '', '', '', '', ''] })));
        setDirty(true);
        toast.success(`Copied ${usable.length} row${usable.length === 1 ? '' : 's'} — fill in the hours`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not load last week'));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="w-[190px] min-w-[190px] px-3 py-2 text-left font-medium">Project</th>
              <th className="min-w-[240px] px-3 py-2 text-left font-medium">Task</th>
              {week.days.map((d) => (
                <th key={d.date} className={cn('w-[64px] px-1 py-2 text-center font-medium', d.date === week.today && 'text-primary')}>
                  {dayLabel(d.date)}
                </th>
              ))}
              <th className="w-[64px] px-2 py-2 text-right font-medium">Total</th>
              {editable && <th className="w-[40px]" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const rowTotal = minutes(r).reduce((a, b) => a + b, 0);
              return (
                <tr key={r.key}>
                  <td className="px-3 py-1.5">
                    {editable ? (
                      <select className={cn(inputClass, 'h-8 text-sm')} value={r.projectId} aria-label="Project" onChange={(e) => update(r.key, { projectId: e.target.value, billable: Boolean(e.target.value) })}>
                        {week.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        <option value="">Internal / non-project</option>
                      </select>
                    ) : (
                      <span className="font-medium">{r.projectId ? projectName(r.projectId) ?? week.lines.find((l) => l.projectId === r.projectId)?.project?.name : 'Internal'}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {editable ? (
                        <input className={cn(inputClass, 'h-8 text-sm')} value={r.task} maxLength={200} placeholder="What did you work on?" aria-label="Task" onChange={(e) => update(r.key, { task: e.target.value })} />
                      ) : (
                        <span>{r.task}</span>
                      )}
                      {r.projectId && (
                        <label className={cn('flex shrink-0 items-center gap-1 text-2xs', r.billable ? 'text-success' : 'text-muted-foreground')} title="Billable to the client">
                          {editable && <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={r.billable} onChange={(e) => update(r.key, { billable: e.target.checked })} />}
                          {r.billable ? 'Billable' : editable ? 'Billable' : 'Non-billable'}
                        </label>
                      )}
                    </div>
                  </td>
                  {r.cells.map((c, i) => {
                    const day = week.days[i]!;
                    const bad = parseHours(c) === null;
                    return (
                      <td key={i} className="px-1 py-1.5 text-center">
                        {editable && !day.future ? (
                          <input
                            className={cn(inputClass, 'h-8 px-1 text-center text-sm tabular-nums', bad && 'border-destructive')}
                            value={c}
                            inputMode="decimal"
                            placeholder="–"
                            aria-label={`${dayLabel(day.date)} hours`}
                            onChange={(e) => setCell(r.key, i, e.target.value)}
                          />
                        ) : (
                          <span className={cn('tabular-nums', !c && 'text-muted-foreground/40')}>{c || '–'}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums">{rowTotal ? toHours(rowTotal) : '–'}</td>
                  {editable && (
                    <td className="px-1">
                      <Button size="icon-sm" variant="ghost" aria-label="Remove row" onClick={() => (setRows((rs) => rs.filter((x) => x.key !== r.key)), setDirty(true))}><Trash2 /></Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border bg-subtle/50 text-xs">
            <tr>
              <td className="px-3 py-2 font-medium" colSpan={2}>Logged</td>
              {dayTotals.map((m, i) => <td key={i} className={cn('px-1 py-2 text-center font-semibold tabular-nums', m > 1440 && 'text-destructive')}>{m ? toHours(m) : '–'}</td>)}
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{toHours(total) || '0'}</td>
              {editable && <td />}
            </tr>
            <tr className="text-muted-foreground">
              <td className="px-3 pb-2" colSpan={2}>Attendance</td>
              {week.days.map((d, i) => {
                const att = d.attendedMinutes;
                const over = att !== null && dayTotals[i]! > att + 30;
                return (
                  <td key={d.date} className={cn('px-1 pb-2 text-center tabular-nums', over && 'text-warning')} title={over ? 'More hours logged than attended' : d.attendance ?? undefined}>
                    {att !== null ? toHours(att) || '0' : d.attendance === 'ON_LEAVE' ? 'Leave' : d.attendance === 'HOLIDAY' ? 'Hol.' : '–'}
                  </td>
                );
              })}
              <td colSpan={editable ? 2 : 1} />
            </tr>
          </tfoot>
        </table>
      </div>

      {(editable || week.canSubmit || week.canRecall) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          {editable && (
            <>
              <Button size="sm" variant="secondary" onClick={() => (setRows((rs) => [...rs, blankRow(week.projects[0]?.id ?? '')]), setDirty(true))}><Plus /> Add row</Button>
              {!week.lines.length && <Button size="sm" variant="ghost" loading={copying} onClick={() => void copyLastWeek()}><Copy /> Copy last week’s rows</Button>}
            </>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{invalid ? 'Use hours like 7.5 or 7:30' : dirty ? 'Unsaved changes' : `${fmtHours(total)} this week`}</span>
          {editable && <Button size="sm" variant="secondary" loading={save.isPending} disabled={!dirty || invalid} onClick={() => void doSave()}><Save /> Save</Button>}
          {(week.canSubmit || (editable && total > 0)) && (
            <Button size="sm" loading={submit.isPending} disabled={invalid || total === 0} onClick={() => void doSubmit()}><Send /> Submit week</Button>
          )}
          {week.canRecall && <Button size="sm" variant="secondary" loading={recall.isPending} onClick={() => recall.mutate(undefined, { onSuccess: () => toast.success('Recalled — you can edit it again'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not recall')) })}><Undo2 /> Recall</Button>}
        </div>
      )}
    </Card>
  );
}

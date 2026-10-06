'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Eye, EyeOff, GitBranch, Loader2, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { inputClass } from '@/components/ui/field';
import { useReportingPreview, useSetReportingLine, type ChartEmployee, type ReportingPreview } from '@/lib/company/org';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

export interface MoveRequest {
  employee: ChartEmployee;
  /** undefined = let the user pick in the dialog; null = top of the organisation */
  managerId?: string | null;
}

/**
 * Change someone's manager. Always previews first: loops are blocked, and
 * the admin sees who gains / loses visibility before confirming.
 */
export function MoveDialog({
  request,
  employees,
  onClose,
}: {
  request: MoveRequest | null;
  employees: ChartEmployee[];
  onClose: () => void;
}) {
  const preview = useReportingPreview();
  const save = useSetReportingLine();
  const [managerId, setManagerId] = useState<string | null | undefined>(undefined);
  const [result, setResult] = useState<ReportingPreview | null>(null);

  useEffect(() => {
    setResult(null);
    setManagerId(request?.managerId);
  }, [request]);

  // Re-run the preview whenever the target changes
  useEffect(() => {
    if (!request || managerId === undefined) return;
    setResult(null);
    preview.mutate(
      { employeeId: request.employee.id, managerId },
      { onSuccess: setResult, onError: (e) => setResult({ valid: false, reason: getApiErrorMessage(e, 'Could not check this change'), moving: [], changes: [] }) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, managerId]);

  if (!request) return null;
  const e = request.employee;
  const name = `${e.firstName} ${e.lastName}`;

  const confirm = async () => {
    try {
      await save.mutateAsync({ employeeId: e.id, managerId: managerId ?? null });
      toast.success(managerId ? `${name} now reports to ${result?.to}` : `${name} is now at the top of the organisation`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not change the reporting line'));
    }
  };

  const canConfirm = Boolean(result?.valid && !result.unchanged && managerId !== undefined);

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<GitBranch />}
      title={`Change manager for ${name}`}
      description="Everyone who reports to them moves along. Access that follows reporting lines updates immediately."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={confirm} disabled={!canConfirm} loading={save.isPending}>Confirm move</Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">New manager</span>
          <Select
            className={inputClass}
            value={managerId === undefined ? '' : managerId ?? '__top'}
            onChange={(ev) => setManagerId(ev.target.value === '' ? undefined : ev.target.value === '__top' ? null : ev.target.value)}
          >
            <option value="">Choose…</option>
            <option value="__top">— Nobody (top of the organisation)</option>
            {employees
              .filter((x) => x.id !== e.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.firstName} {x.lastName}
                  {x.designation ? ` — ${x.designation.name}` : ''}
                </option>
              ))}
          </Select>
        </label>

        {managerId !== undefined && (preview.isPending || !result) && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking the impact…
          </p>
        )}

        {result && !result.valid && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {result.reason}
          </p>
        )}
        {result?.unchanged && <p className="text-sm text-muted-foreground">{name} already reports there — nothing to change.</p>}

        {result?.valid && !result.unchanged && (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{result.from ?? 'Top of the organisation'}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-primary">{result.to ?? 'Top of the organisation'}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {result.moving.length} {result.moving.length === 1 ? 'person moves' : 'people move'}
              </span>
            </div>
            {result.moving.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Moving with {e.firstName}: {result.moving.slice(1, 9).map((m) => m.name).join(', ')}
                {result.moving.length > 9 ? ` and ${result.moving.length - 9} more` : ''}
              </p>
            )}

            <div>
              <p className="mb-2 text-[13px] font-medium">Who can see them through the reporting line</p>
              {result.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reporting-line access changes. Company- and department-wide access (e.g. HR) is unaffected.</p>
              ) : (
                <ul className="space-y-1.5">
                  {result.changes.map((c) => (
                    <li key={c.employeeId} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                          c.effect === 'gains' && 'bg-success/15 text-success',
                          c.effect === 'loses' && 'bg-destructive/10 text-destructive',
                          c.effect === 'keeps' && 'bg-muted text-muted-foreground',
                        )}
                      >
                        {c.effect === 'gains' ? <Eye className="h-3.5 w-3.5" /> : c.effect === 'loses' ? <EyeOff className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </span>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        {c.effect === 'gains' ? 'gains access' : c.effect === 'loses' ? 'loses access' : 'keeps access'}
                      </span>
                      <Badge tone="neutral" className="ml-auto">{c.relation}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, PauseCircle, Ban } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { useUpdateCompanyStatus } from '@/lib/admin/queries';
import type { CompanyStatus } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const OPTIONS: Array<{ value: CompanyStatus; label: string; description: string; icon: React.ReactNode; tone: string }> = [
  {
    value: 'ACTIVE',
    label: 'Active',
    description: 'Users can sign in and use the portal.',
    icon: <CheckCircle2 />,
    tone: 'text-emerald-600 border-emerald-500 bg-emerald-500/5',
  },
  {
    value: 'INACTIVE',
    label: 'Inactive',
    description: 'Paused, e.g. trial ended. Users are signed out and blocked.',
    icon: <PauseCircle />,
    tone: 'text-slate-600 border-slate-500 bg-slate-500/5',
  },
  {
    value: 'SUSPENDED',
    label: 'Suspended',
    description: 'Blocked for a policy or billing issue. Users are signed out and blocked.',
    icon: <Ban />,
    tone: 'text-red-600 border-red-500 bg-red-500/5',
  },
];

/** Pick a new company status (with optional reason) and confirm. */
export function StatusChangeDialog({
  company,
  initialStatus,
  onClose,
}: {
  company: { id: string; name: string; status: CompanyStatus } | null;
  initialStatus?: CompanyStatus;
  onClose: () => void;
}) {
  const mutation = useUpdateCompanyStatus();
  const [status, setStatus] = useState<CompanyStatus>('ACTIVE');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (company) {
      setStatus(initialStatus ?? (company.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'));
      setReason('');
    }
  }, [company, initialStatus]);

  if (!company) return null;

  const blocking = status !== 'ACTIVE';
  const unchanged = status === company.status;

  const submit = async () => {
    try {
      const result = await mutation.mutateAsync({ id: company.id, status, reason: reason.trim() || undefined });
      toast.success(
        `${company.name} is now ${status.toLowerCase()}` +
          (result.revokedSessions ? ` · ${result.revokedSessions} session(s) signed out` : ''),
      );
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update company status'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={mutation.isPending}
      title={`Change status · ${company.name}`}
      description={`Currently ${company.status.toLowerCase()}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={blocking ? 'danger' : 'success'}
            onClick={submit}
            loading={mutation.isPending}
            disabled={unchanged}
          >
            {blocking ? `Set ${status.toLowerCase()}` : 'Activate company'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" className="grid gap-2">
          {OPTIONS.map((opt) => {
            const selected = opt.value === status;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStatus(opt.value)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all',
                  selected ? opt.tone : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
                )}
              >
                <span className={cn('mt-0.5 [&>svg]:h-5 [&>svg]:w-5', selected ? '' : 'text-slate-400')}>{opt.icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    {opt.label}
                    {opt.value === company.status && (
                      <span className="ml-2 text-[10px] font-medium uppercase text-slate-400">current</span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{opt.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        {blocking && !unchanged && (
          <Field label="Reason (recorded in the audit log)" htmlFor="status-reason" hint="Optional, max 500 characters.">
            <textarea
              id="status-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Payment overdue since 1 Sep"
              className={cn(inputClass, 'h-auto py-2 resize-none')}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

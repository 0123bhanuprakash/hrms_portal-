'use client';

import React from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, UserPlus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';

/** Everyone in a company is an employee: create a basic profile for my own account. */
export function useCreateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/employees/me')).data.data as { id: string; employeeId: string },
    onSuccess: () => void qc.invalidateQueries(),
  });
}

/**
 * Shown where a page needs an employee profile and the account has none
 * (e.g. a company admin from before "everyone is an employee").
 */
export function NoProfile({ icon = <UserRound />, what }: { icon?: React.ReactNode; what: string }) {
  const create = useCreateMyProfile();
  return (
    <EmptyState
      icon={icon}
      title="Your account has no employee profile yet"
      description={`${what} Everyone in the company is an employee — create your profile with one click, then fill in your job title and department.`}
      action={
        <Button
          loading={create.isPending}
          onClick={async () => {
            try {
              const e = await create.mutateAsync();
              toast.success(`Your employee profile is ready (${e.employeeId}) — complete it from My profile`);
            } catch (err) {
              toast.error(getApiErrorMessage(err, 'Could not create your profile'));
            }
          }}
        >
          <UserPlus /> Create my employee profile
        </Button>
      }
    />
  );
}

/** "Complete your profile": what is still missing on my own employee record. */
export function CompleteProfileNudge() {
  const me = useMyCard();
  const { can } = useAccess();
  const e = me.data?.employee;
  if (!e) return null;
  const missing = [!e.designation && 'job title', !e.department && 'department', !e.location && 'office'].filter(Boolean) as string[];
  if (!missing.length) return null;
  const href = can('employee.edit') ? `/app/employees/${e.id}` : '/app/profile';
  return (
    <div className="m-rise flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary-soft/50 px-4 py-3 text-sm">
      <UserRound className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        <b>Complete your profile.</b> Still missing: {missing.join(', ')}.{!can('employee.edit') && ' Your HR team can fill in your job title and department.'}
      </p>
      <Button size="sm" variant="secondary" asChild>
        <Link href={href}>Complete it <ArrowRight /></Link>
      </Button>
    </div>
  );
}

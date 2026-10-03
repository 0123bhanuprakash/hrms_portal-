'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Receipt, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, Tabs } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ClaimList } from '@/components/expenses/claim-list';
import { useAccess } from '@/lib/access/use-access';
import { useMyProjects } from '@/lib/company/projects';
import { useMyCard } from '@/lib/company/profile';
import { useClaims, useSaveClaim, type ClaimStatus } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';

export default function MyExpensesPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = useClaims({ view: 'mine', status: status || undefined, page });

  if (!accessLoading && !(hasFeature('ops.expenses') && can('expense.submit'))) return <EmptyState icon={<ShieldCheck />} title="Expenses aren’t available" />;
  if (me.isSuccess && !me.data?.employee) return <EmptyState icon={<Receipt />} title="No employee profile" description="Expense claims need an employee profile." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Expenses"
        title="My expenses"
        description="Claim money you spent for work. Your manager approves, then Finance and HR, then Finance pays you."
        action={<Button onClick={() => setCreating(true)}><Plus /> New claim</Button>}
      />
      <Tabs
        tabs={[
          { id: '' as const, label: 'All' },
          { id: 'DRAFT' as const, label: 'Drafts' },
          { id: 'PENDING' as const, label: 'Waiting' },
          { id: 'REJECTED' as const, label: 'Sent back' },
          { id: 'APPROVED' as const, label: 'To be paid' },
          { id: 'PAID' as const, label: 'Paid' },
        ]}
        value={status}
        onChange={(s) => { setStatus(s); setPage(1); }}
      />
      <ClaimList query={list} empty="No claims here" page={page} onPage={setPage} />
      {creating && <NewClaimDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewClaimDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const save = useSaveClaim();
  const projects = useMyProjects();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const mine = (projects.data ?? []).filter((a) => a.active);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const c = await save.mutateAsync({ title, projectId: projectId || null });
      onClose();
      router.push(`/app/expenses/${c.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not create the claim'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Receipt />}
      title="New expense claim"
      description="Next you’ll add each expense with its receipt."
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="new-claim" loading={save.isPending}>Create</Button>
        </>
      }
    >
      <form id="new-claim" onSubmit={submit} className="space-y-3">
        <Field label="Title" htmlFor="nc-title" required hint="e.g. Client visit — Mumbai, October">
          <Input id="nc-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} />
        </Field>
        {mine.length > 0 && (
          <Field label="Project (optional)" htmlFor="nc-project">
            <select id="nc-project" className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Not for a project</option>
              {mine.map((a) => <option key={a.project.id} value={a.project.id}>{a.project.name}</option>)}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  );
}

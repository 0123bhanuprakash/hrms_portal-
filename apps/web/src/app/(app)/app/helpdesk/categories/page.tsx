'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, ShieldCheck, Tags } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useAccess } from '@/lib/access/use-access';
import { QUEUE_INFO, useMyQueues, useSaveTicketCategory, useTicketCategories, type Queue, type TicketCategory } from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

export default function TicketCategoriesPage() {
  const { hasFeature, isLoading: accessLoading } = useAccess();
  const queues = useMyQueues();
  const allowed = hasFeature('ops.helpdesk') && queues.length > 0;
  const cats = useTicketCategories(true, allowed);
  const [editing, setEditing] = useState<TicketCategory | Queue | null>(null);
  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Helpdesk" title="Ticket topics" description="The topics employees pick when they raise a ticket. Each team manages its own." />
      {cats.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        queues.map((q) => (
          <Card key={q} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">{QUEUE_INFO[q].label}</h2>
              <Button size="sm" variant="secondary" onClick={() => setEditing(q)}><Plus /> Add topic</Button>
            </div>
            <ul className="divide-y divide-border">
              {(cats.data ?? []).filter((c) => c.queue === q).map((c) => (
                <li key={c.id} className={cn('flex items-center gap-3 px-5 py-2.5', !c.isActive && 'opacity-55')}>
                  <p className="min-w-0 flex-1">{c.name}</p>
                  {!c.isActive && <Badge>Hidden</Badge>}
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil /></Button>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
      <CategoryDialog value={editing} queues={queues} onClose={() => setEditing(null)} />
    </div>
  );
}

function CategoryDialog({ value, queues, onClose }: { value: TicketCategory | Queue | null; queues: Queue[]; onClose: () => void }) {
  const save = useSaveTicketCategory();
  const [f, setF] = useState({ queue: 'IT' as Queue, name: '', isActive: true });
  useEffect(() => {
    if (!value) return;
    setF(typeof value === 'string' ? { queue: value, name: '', isActive: true } : { queue: value.queue, name: value.name, isActive: value.isActive });
  }, [value]);
  if (!value) return null;
  const isNew = typeof value === 'string';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({ ...(!isNew && { id: value.id }), ...f });
      toast.success('Topic saved');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={save.isPending} icon={<Tags />} title={isNew ? `Add ${QUEUE_INFO[f.queue].label} topic` : `Edit ${value.name}`} className="sm:max-w-md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="tcat-form" loading={save.isPending}>Save</Button></>}>
      <form id="tcat-form" onSubmit={submit} className="space-y-3">
        <Field label="Name" htmlFor="tc-name" required><Input id="tc-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={60} /></Field>
        {!isNew && queues.length > 1 && (
          <Field label="Team" htmlFor="tc-queue">
            <select id="tc-queue" className={inputClass} value={f.queue} onChange={(e) => setF({ ...f, queue: e.target.value as Queue })}>
              {queues.map((q) => <option key={q} value={q}>{QUEUE_INFO[q].label}</option>)}
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Employees can pick it</label>
      </form>
    </Modal>
  );
}

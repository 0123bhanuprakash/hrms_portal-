'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LifeBuoy, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { QUEUES, QUEUE_INFO, SLA_HOURS, useCreateTicket, useTicketCategories, type Queue } from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.docx';
const hours = (h: number) => (h < 24 ? `${h} hour${h === 1 ? '' : 's'}` : `${h / 24} day${h === 24 ? '' : 's'}`);

export function NewTicketDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const create = useCreateTicket();
  const cats = useTicketCategories(false, open);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [f, setF] = useState({ categoryId: '', subject: '', description: '', priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' });
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (!open) return;
    setQueue(null);
    setF({ categoryId: '', subject: '', description: '', priority: 'MEDIUM' });
    setFile(null);
  }, [open]);
  if (!open) return null;

  const options = (cats.data ?? []).filter((c) => c.queue === queue);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queue) return;
    try {
      const t = await create.mutateAsync({ queue, ...f, categoryId: f.categoryId || undefined, file });
      toast.success(`Ticket #${t.number} sent to ${QUEUE_INFO[queue].label}`);
      onClose();
      router.push(`/app/helpdesk/${t.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not raise the ticket'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={create.isPending}
      icon={<LifeBuoy />}
      title="Raise a ticket"
      description="Ask IT, HR or Finance for help. Your name is on every ticket."
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button type="submit" form="ticket-form" loading={create.isPending} disabled={!queue}>Send</Button>
        </>
      }
    >
      <form id="ticket-form" onSubmit={submit} className="space-y-3">
        <Field label="Which team?" required>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {QUEUES.map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={queue === q}
                onClick={() => { setQueue(q); setF((x) => ({ ...x, categoryId: '' })); }}
                className={cn('rounded-md border px-3 py-2 text-left transition-colors', queue === q ? 'border-primary bg-primary-soft' : 'border-border hover:bg-subtle')}
              >
                <p className="text-sm font-semibold">{QUEUE_INFO[q].label}</p>
                <p className="text-2xs text-muted-foreground">{QUEUE_INFO[q].text}</p>
              </button>
            ))}
          </div>
        </Field>
        {queue && (
          <>
            {options.length > 0 && (
              <Field label="Topic" htmlFor="tk-cat">
                <select id="tk-cat" className={inputClass} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                  <option value="">Choose a topic</option>
                  {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Subject" htmlFor="tk-subject" required>
              <Input id="tk-subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required minLength={5} maxLength={150} placeholder={queue === 'IT' ? 'e.g. VPN disconnects every few minutes' : queue === 'HR' ? 'e.g. Need an address proof letter' : 'e.g. Wrong HRA in September payslip'} />
            </Field>
            <Field label="Details" htmlFor="tk-desc" required hint="What happened, since when, and what you’ve tried.">
              <Textarea id="tk-desc" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required minLength={10} maxLength={5000} />
            </Field>
            <Field label="How urgent?" htmlFor="tk-priority" hint={`First reply within ${hours(SLA_HOURS[f.priority].response)}; fixed within ${hours(SLA_HOURS[f.priority].resolution)}.`}>
              <select id="tk-priority" className={inputClass} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as typeof f.priority })}>
                <option value="LOW">Low — whenever possible</option>
                <option value="MEDIUM">Medium — affects my work</option>
                <option value="HIGH">High — I’m blocked</option>
              </select>
            </Field>
            <div>
              {file ? (
                <span className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-sm">
                  <Paperclip className="h-3.5 w-3.5" /> {file.name}
                  <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </span>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
                  <Paperclip className="h-4 w-4" /> Attach a screenshot or file
                  <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

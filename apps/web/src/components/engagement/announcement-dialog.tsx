'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useDepartments, useLocations } from '@/lib/company/org';
import { useSaveAnnouncement, type Announcement, type AnnouncementInput, type Audience } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const EMPTY: AnnouncementInput = { title: '', body: '', audience: 'COMPANY', departmentIds: [], locationIds: [], pinned: false, requiresAck: false, sendEmail: false, expiresAt: null };
const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

/** Post / edit an announcement. The poster decides whether it is also emailed. */
export function AnnouncementDialog({ value, onClose, onSaved }: { value: Announcement | 'new' | null; onClose: () => void; onSaved?: (a: Announcement) => void }) {
  const save = useSaveAnnouncement();
  const departments = useDepartments();
  const locations = useLocations();
  const fileInput = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<AnnouncementInput>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setError(null);
    setFile(null);
    setF(
      value === 'new'
        ? EMPTY
        : { title: value.title, body: value.body, audience: value.audience, departmentIds: value.departmentIds, locationIds: value.locationIds, pinned: value.pinned, requiresAck: value.requiresAck, sendEmail: value.sendEmail, expiresAt: toLocalInput(value.expiresAt) || null },
    );
  }, [value]);
  if (!value) return null;
  const isNew = value === 'new';
  const set = <K extends keyof AnnouncementInput>(k: K, v: AnnouncementInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k: 'departmentIds' | 'locationIds', id: string) =>
    setF((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (file && file.size > 10 * 1024 * 1024) return setError('Attachment must be 10 MB or smaller');
    try {
      const a = await save.mutateAsync({
        ...f,
        ...(!isNew && { id: value.id }),
        // End of the chosen day
        expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : null,
        file,
      });
      toast.success(isNew ? (f.sendEmail ? 'Posted — everyone is notified and emailed' : 'Posted — everyone is notified') : 'Announcement updated');
      onSaved?.(a);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the announcement'));
    }
  };

  const chips = (items: Array<{ id: string; name: string }> | undefined, key: 'departmentIds' | 'locationIds') => (
    <div className="flex flex-wrap gap-1.5">
      {(items ?? []).map((i) => {
        const on = f[key].includes(i.id);
        return (
          <button
            key={i.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(key, i.id)}
            className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border text-muted-foreground hover:bg-subtle')}
          >
            {i.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Megaphone />}
      title={isNew ? 'New announcement' : 'Edit announcement'}
      description={isNew ? 'Everyone in the audience gets a notification in the portal.' : 'Edits don’t notify people again.'}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="announcement-form" loading={save.isPending}>{isNew ? 'Post' : 'Save'}</Button>
        </>
      }
    >
      <form id="announcement-form" onSubmit={submit} className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Field label="Title" htmlFor="an-title" required><Input id="an-title" value={f.title} onChange={(e) => set('title', e.target.value)} required minLength={3} maxLength={150} /></Field>
        <Field label="Message" htmlFor="an-body" required aside={<span className="text-xs text-muted-foreground tabular-nums">{f.body.length}/5000</span>}>
          <Textarea id="an-body" value={f.body} onChange={(e) => set('body', e.target.value)} required minLength={3} maxLength={5000} rows={6} />
        </Field>

        <Field label="Who should see it">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {([
                ['COMPANY', 'Everyone'],
                ['DEPARTMENTS', 'Departments'],
                ['LOCATIONS', 'Locations'],
              ] as Array<[Audience, string]>).map(([k, label]) => (
                <label key={k} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm', f.audience === k ? 'border-primary bg-primary-soft/40' : 'border-border')}>
                  <input type="radio" name="an-audience" className="accent-[hsl(var(--primary))]" checked={f.audience === k} onChange={() => set('audience', k)} /> {label}
                </label>
              ))}
            </div>
            {f.audience === 'DEPARTMENTS' && (
              <>
                {chips(departments.data, 'departmentIds')}
                <p className="text-xs text-muted-foreground">Sub-departments are included.</p>
              </>
            )}
            {f.audience === 'LOCATIONS' && chips(locations.data, 'locationIds')}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['sendEmail', 'Also email everyone', 'Off = notification in the portal only'],
            ['requiresAck', 'Ask people to confirm they read it', 'Shows a “I have read this” button and tracks who did'],
            ['pinned', 'Pin to the top', 'Stays above newer posts'],
          ] as const).map(([k, label, hint]) => (
            <label key={k} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f[k]} onChange={(e) => set(k, e.target.checked)} disabled={k === 'sendEmail' && !isNew} />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{k === 'sendEmail' && !isNew ? 'Only when posting' : hint}</span>
              </span>
            </label>
          ))}
          <Field label="Hide after" htmlFor="an-expires" hint="Optional">
            <Input id="an-expires" type="date" value={f.expiresAt ?? ''} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set('expiresAt', e.target.value || null)} />
          </Field>
        </div>

        <div>
          <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" className="sr-only" tabIndex={-1} onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          {file ? (
            <p className="flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4" /> {file.name}
              <Button size="icon-sm" variant="ghost" aria-label="Remove file" onClick={() => setFile(null)}><X /></Button>
            </p>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
              <Paperclip /> {!isNew && value.attachmentName ? `Replace ${value.attachmentName}` : 'Attach a file'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

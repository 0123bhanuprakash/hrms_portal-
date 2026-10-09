'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, BookOpen, Eye, Plus, Tags, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import {
  PRIORITY,
  SLA_HOURS,
  useHelpdeskQueues,
  useHelpdeskTeams,
  useSaveTicketCategory,
  type Priority,
  type QuestionKind,
  type Queue,
  type TicketCategory,
  type TopicQuestion,
} from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { PersonSelect, Select } from '@/components/ui/pickers';

const ICONS = ['💻', '🧩', '🔑', '✉️', '📶', '🖥️', '🖨️', '📱', '🌴', '📄', '📘', '🩺', '🪪', '💸', '🧾', '🧮', '🏦', '☁️', '🚀', '🛠️', '🔒', '🎧', '❓', '🏷️'];
const KINDS: Record<QuestionKind, string> = { text: 'Short answer', choice: 'Pick one', device: 'Their device' };
const hours = (h: number) => (h < 24 ? `${h} h` : `${h / 24} day${h === 24 ? '' : 's'}`);
const slug = (label: string, taken: string[]) => {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'q';
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base.slice(0, 18)}-${i}`;
  return id;
};

interface Form {
  queue: Queue;
  name: string;
  isActive: boolean;
  icon: string;
  description: string;
  defaultPriority: Priority | '';
  routeToId: string;
  questions: Array<TopicQuestion & { optionsText: string }>;
  quickAnswer: string;
}

/**
 * Add / edit a topic. Left: settings (basics, routing, questions, quick answer).
 * Right: what the employee sees when they pick it.
 */
export function TopicEditor({ value, queues, onClose }: { value: TicketCategory | Queue | null; queues: Queue[]; onClose: () => void }) {
  const save = useSaveTicketCategory();
  const [f, setF] = useState<Form | null>(null);
  const teams = useHelpdeskTeams(Boolean(value));
  const hq = useHelpdeskQueues();

  useEffect(() => {
    if (!value) return setF(null);
    setF(
      typeof value === 'string'
        ? { queue: value, name: '', isActive: true, icon: '🏷️', description: '', defaultPriority: '', routeToId: '', questions: [], quickAnswer: '' }
        : {
            queue: value.queue,
            name: value.name,
            isActive: value.isActive,
            icon: value.icon ?? '',
            description: value.description ?? '',
            defaultPriority: value.defaultPriority ?? '',
            routeToId: value.routeToId ?? '',
            questions: value.questions.map((q) => ({ ...q, optionsText: (q.options ?? []).join(', ') })),
            quickAnswer: value.quickAnswer ?? '',
          },
    );
  }, [value]);
  if (!value || !f) return null;

  const isNew = typeof value === 'string';
  const team = teams.data?.teams.find((t) => t.queue === f.queue);
  const people = (team?.members ?? []).filter((m) => m.inQueue && m.active);
  const head = team?.headId ? team.members.find((m) => m.id === team.headId) : null;
  const route = f.routeToId ? people.find((m) => m.id === f.routeToId) : null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const setQ = (i: number, patch: Partial<Form['questions'][number]>) => set('questions', f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const moveQ = (i: number, by: number) => {
    const qs = [...f.questions];
    const j = i + by;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j]!, qs[i]!];
    set('questions', qs);
  };
  const addQ = () => set('questions', [...f.questions, { id: slug('question', f.questions.map((q) => q.id)), label: '', kind: 'text', required: false, optionsText: '' }]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const questions = f.questions
      .filter((q) => q.label.trim())
      .map(({ optionsText, ...q }) => ({
        ...q,
        label: q.label.trim(),
        ...(q.kind === 'choice' ? { options: [...new Set(optionsText.split(',').map((o) => o.trim()).filter(Boolean))] } : { options: undefined }),
      }));
    if (questions.some((q) => q.kind === 'choice' && (q.options?.length ?? 0) < 2)) return void toast.error('A “Pick one” question needs at least 2 options, separated by commas');
    try {
      await save.mutateAsync({
        ...(!isNew && { id: value.id }),
        queue: f.queue,
        name: f.name.trim(),
        isActive: f.isActive,
        icon: f.icon || null,
        description: f.description.trim() || null,
        defaultPriority: f.defaultPriority || null,
        routeToId: f.routeToId || null,
        questions,
        quickAnswer: f.quickAnswer.trim() || null,
      });
      toast.success('Topic saved');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  const prio: Priority = f.defaultPriority || 'MEDIUM';
  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Tags />}
      title={isNew ? `Add ${hq.info(f.queue).label} topic` : `Edit topic — ${value.name}`}
      description="Left: settings. Right: what the employee sees when they pick it."
      className="sm:max-w-5xl"
      footer={<><Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button><Button type="submit" form="topic-form" loading={save.isPending}>Save topic</Button></>}
    >
      <form id="topic-form" onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Basics */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Basics</h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <Field label="Name" htmlFor="tp-name" required><Input id="tp-name" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={60} placeholder="e.g. Network & VPN" /></Field>
              <Field label="Team" htmlFor="tp-team">
                <Select id="tp-team" className={inputClass} value={f.queue} disabled={queues.length < 2} onChange={(e) => setF({ ...f, queue: e.target.value as Queue, routeToId: '' })}>
                  {queues.map((q) => <option key={q} value={q}>{hq.info(q).emoji} {hq.info(q).label}</option>)}
                </Select>
              </Field>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Icon</p>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Icon">
                {ICONS.map((i) => (
                  <button key={i} type="button" role="radio" aria-checked={f.icon === i} onClick={() => set('icon', i)} className={cn('flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors', f.icon === i ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-subtle')}>{i}</button>
                ))}
              </div>
            </div>
            <Field label="Short help line" htmlFor="tp-desc" hint="One line under the name, so people pick the right topic.">
              <Input id="tp-desc" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={120} placeholder="e.g. Wi-Fi, VPN, slow internet in office" />
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Employees can pick it</label>
          </section>

          {/* Routing */}
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Routing</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New tickets go to" htmlFor="tp-route" hint={f.routeToId ? 'Assigned to them at once.' : head ? `${head.firstName} (head) assigns them.` : 'Anyone in the team takes them.'}>
                <PersonSelect id="tp-route" value={f.routeToId} onChange={(v) => set('routeToId', v)} emptyLabel={head ? `${hq.info(f.queue).label} head (${head.firstName}) — assigns` : `The ${hq.info(f.queue).label} team`} people={people} />
              </Field>
              <Field label="Starting priority" htmlFor="tp-prio" hint="The employee can still change it.">
                <Select id="tp-prio" className={inputClass} value={f.defaultPriority} onChange={(e) => set('defaultPriority', e.target.value as Priority | '')}>
                  <option value="">Medium (default)</option>
                  {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
                </Select>
              </Field>
            </div>
            <p className="rounded-md bg-subtle px-3 py-2 text-xs text-muted-foreground">Reply targets always follow the priority: Urgent 1 h / 8 h · High 4 h / 1 day · Medium 8 h / 3 days · Low 1 day / 5 days.</p>
          </section>

          {/* Questions */}
          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Questions to ask <span className="font-normal text-muted-foreground">· up to 5</span></h3>
              <Button type="button" size="sm" variant="secondary" onClick={addQ} disabled={f.questions.length >= 5}><Plus /> Add a question</Button>
            </div>
            {!f.questions.length && <p className="text-xs text-muted-foreground">None — the employee writes a subject and details only.</p>}
            {f.questions.map((q, i) => (
              <div key={q.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input aria-label={`Question ${i + 1}`} value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} placeholder="e.g. Where do you work from?" maxLength={80} className="flex-1" />
                  <Select aria-label="Answer type" className={cn(inputClass, 'w-36')} value={q.kind} onChange={(e) => setQ(i, { kind: e.target.value as QuestionKind })}>
                    {(Object.keys(KINDS) as QuestionKind[]).map((k) => <option key={k} value={k} disabled={k === 'device' && q.kind !== 'device' && f.questions.some((x) => x.kind === 'device')}>{KINDS[k]}</option>)}
                  </Select>
                </div>
                {q.kind === 'choice' && <Input aria-label="Options" value={q.optionsText} onChange={(e) => setQ(i, { optionsText: e.target.value })} placeholder="Options, separated by commas — e.g. Office, Home, Client site" />}
                {q.kind === 'device' && <p className="text-xs text-muted-foreground">They pick one of their devices from My assets — it gets linked to the ticket.</p>}
                <div className="flex items-center gap-1 text-sm">
                  <label className="mr-auto flex items-center gap-2"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Required</label>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => moveQ(i, -1)}><ArrowUp /></Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === f.questions.length - 1} onClick={() => moveQ(i, 1)}><ArrowDown /></Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove question" onClick={() => set('questions', f.questions.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              </div>
            ))}
          </section>

          {/* Quick answer */}
          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><BookOpen className="h-4 w-4" /> Quick answer</h3>
            <Textarea rows={3} aria-label="Quick answer" value={f.quickAnswer} onChange={(e) => set('quickAnswer', e.target.value)} maxLength={1000} placeholder="e.g. VPN drops after a Windows update? Reinstall the VPN app from Company Portal, then restart." />
            <p className="text-xs text-muted-foreground">
              Shown above “Send” when someone picks this topic or types similar words.
              {!isNew && value.helpedCount ? ` It helped ${value.helpedCount} ${value.helpedCount === 1 ? 'person' : 'people'} without a ticket so far.` : ''}
            </p>
          </section>
        </div>

        {/* Live preview */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Live preview — what the employee sees</p>
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary-soft px-3 py-1 text-sm font-medium text-primary">{f.icon} {f.name || 'Topic name'}</span>
            {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
            {f.quickAnswer.trim() && (
              <div className="rounded-lg border border-warning/40 bg-warning-soft/50 p-3 text-xs">
                <p className="font-semibold">💡 This may help</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{f.quickAnswer}</p>
              </div>
            )}
            {f.questions.filter((q) => q.label.trim()).map((q) => (
              <div key={q.id} className="space-y-1">
                <p className="text-xs font-medium">{q.label}{q.required && ' *'}</p>
                <div className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                  {q.kind === 'choice' ? (q.optionsText.split(',').map((o) => o.trim()).filter(Boolean).join(' · ') || 'Options…') : q.kind === 'device' ? '💻 LAP-0042 · MacBook Pro ▾' : 'Type here…'}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t border-border pt-3 text-xs">
              {route ? <PersonAvatar person={route} size="sm" /> : head ? <PersonAvatar person={head} size="sm" /> : null}
              <span>
                Goes to <b>{route ? route.firstName : head ? `the ${hq.info(f.queue).label} head` : `the ${hq.info(f.queue).label} team`}</b> · first reply within {hours(SLA_HOURS[prio].response)}
              </span>
              {f.defaultPriority && <Badge tone={PRIORITY[f.defaultPriority].tone} className="ml-auto px-1.5 py-0 text-2xs">{PRIORITY[f.defaultPriority].label}</Badge>}
            </div>
          </div>
        </aside>
      </form>
    </Modal>
  );
}

'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, Check, Lightbulb, Paperclip, Send, ShieldCheck, ThumbsUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { QUEUE_EMOJI, replyTime } from '@/components/helpdesk/ticket-visuals';
import { useReducedMotion } from '@/components/motion/motion';
import { useAccess } from '@/lib/access/use-access';
import { useMyAssets } from '@/lib/company/assets';
import {
  PRIORITY,
  QUEUES,
  QUEUE_INFO,
  SLA_HOURS,
  useCreateTicket,
  useHelpdeskDirectory,
  useQuickAnswers,
  useTicketCategories,
  useTopicHelped,
  type Priority,
  type Queue,
} from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.docx';
const hours = (h: number) => (h < 24 ? `${h} h` : `${h / 24} day${h === 24 ? '' : 's'}`);
type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';
const URGENCY: Array<[Urgency, string, string]> = [
  ['LOW', 'Can wait', 'Whenever possible'],
  ['MEDIUM', 'Slows me down', 'Affects my work'],
  ['HIGH', 'I can’t work', 'I’m blocked'],
];
const PLACEHOLDER: Record<Queue, string> = {
  IT: 'e.g. VPN disconnects every 20 minutes',
  HR: 'e.g. Need an address-proof letter for my bank',
  FINANCE: 'e.g. Travel claim for the Pune trip not paid',
  DEVOPS: 'e.g. Need access to the staging database',
};

export default function RaiseTicketPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RaiseTicket />
    </Suspense>
  );
}

function RaiseTicket() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('ops.helpdesk') && can('ticket.create');
  const cats = useTicketCategories(false, allowed);
  const directory = useHelpdeskDirectory(allowed);
  const create = useCreateTicket();
  const thanks = useTopicHelped();
  const reduced = useReducedMotion();

  const [queue, setQueue] = useState<Queue | null>(() => (QUEUES.includes(params.get('queue') as Queue) ? (params.get('queue') as Queue) : null));
  const [topicId, setTopicId] = useState(params.get('topic') ?? '');
  const [subject, setSubject] = useState(params.get('subject') ?? '');
  const [details, setDetails] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [helped, setHelped] = useState(false);
  const [flying, setFlying] = useState<{ x: number; y: number } | null>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const teamRefs = useRef<Partial<Record<Queue, HTMLButtonElement | null>>>({});

  const topics = useMemo(() => (cats.data ?? []).filter((c) => c.queue === queue), [cats.data, queue]);
  const topic = topics.find((c) => c.id === topicId);
  // A topic picked from a quick answer may belong to another team than the one in the link
  useEffect(() => {
    if (!topicId || !cats.data) return;
    const t = cats.data.find((c) => c.id === topicId);
    if (t && t.queue !== queue) setQueue(t.queue);
  }, [topicId, cats.data, queue]);
  const devices = useMyAssets(Boolean(topic?.questions.some((q) => q.kind === 'device')));

  // "These may help" follows the subject as it is typed
  const [q, setQ] = useState(subject);
  useEffect(() => {
    const t = setTimeout(() => setQ(subject), 400);
    return () => clearTimeout(t);
  }, [subject]);
  const hints = useQuickAnswers(q);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="You can’t raise tickets" />;

  const startPriority: Priority = topic?.defaultPriority ?? 'MEDIUM';
  const shown: Urgency = urgency ?? (startPriority === 'URGENT' ? 'HIGH' : (startPriority as Urgency));
  const priority: Priority = urgency ?? startPriority;
  const team = directory.data?.find((d) => d.queue === queue);
  const who = topic?.routeTo ? { name: `${topic.routeTo.firstName} ${topic.routeTo.lastName}`, person: topic.routeTo, note: `Topic “${topic.name}” goes straight to ${topic.routeTo.firstName}` }
    : team?.head ? { name: `${QUEUE_INFO[team.queue].label} team · ${team.head.firstName} ${team.head.lastName} (head)`, person: team.head, note: `${team.head.firstName} assigns it to someone in the team` }
    : queue ? { name: `The ${QUEUE_INFO[queue].label} team`, person: null, note: 'Anyone in the team picks it up' } : null;
  const step = !queue ? 1 : !topicId && topics.length ? 2 : 3;
  const ready = Boolean(queue && subject.trim().length >= 5 && details.trim().length >= 10);

  const pickTeam = (qq: Queue) => {
    setQueue(qq);
    setTopicId('');
    setAnswers({});
    setHelped(false);
  };
  const pickTopic = (id: string) => {
    setTopicId(id);
    setAnswers({});
    setHelped(false);
    setUrgency(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queue) return;
    try {
      const t = await create.mutateAsync({
        queue,
        categoryId: topicId || undefined,
        subject: subject.trim(),
        description: details.trim(),
        // Untouched → the topic's starting priority (it may start as Urgent)
        priority: urgency ?? undefined,
        answers: topic?.questions.length ? answers : undefined,
        file,
      });
      toast.success(`Ticket #${t.number} sent to ${QUEUE_INFO[queue].label}`);
      const from = sendRef.current?.getBoundingClientRect();
      const to = teamRefs.current[queue]?.getBoundingClientRect();
      if (reduced || !from || !to) return router.push(`/app/helpdesk/${t.id}`);
      // The paper plane flies from Send to the team's card, then the ticket opens
      setFlying({ x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2) });
      setTimeout(() => router.push(`/app/helpdesk/${t.id}`), 1150);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not raise the ticket'));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Link href="/app/helpdesk" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> My tickets</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Raise a ticket</h1>
        <p className="text-sm text-muted-foreground">Three short steps — the right team, the right topic, the right details.</p>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Steps">
        {['Which team', 'What is it about', 'Details'].map((s, i) => {
          const n = i + 1;
          const done = n < step;
          return (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span className={cn('h-0.5 w-8 rounded-full', done || n === step ? 'bg-primary' : 'bg-border')} />}
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium', done ? 'border-success/40 text-success' : n === step ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted-foreground')}>
                {done ? <Check className="h-3.5 w-3.5" /> : <span className="tabular-nums">{n}</span>} {s}
              </span>
            </li>
          );
        })}
      </ol>

      <div className={cn('grid items-start gap-5 lg:grid-cols-[1fr_360px]', flying && 'pointer-events-none')}>
        <div className={cn('space-y-4', flying && 'hd-fold')}>
          {/* 1 · Team */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" role="radiogroup" aria-label="Which team">
            {QUEUES.map((qq) => {
              const d = directory.data?.find((x) => x.queue === qq);
              const on = queue === qq;
              return (
                <button
                  key={qq}
                  ref={(el) => { teamRefs.current[qq] = el; }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickTeam(qq)}
                  className={cn('emo-host m-lift relative rounded-xl border-2 bg-card p-3.5 text-left transition-colors', on ? 'border-primary ring-4 ring-primary/10' : 'border-border hover:border-primary/40', flying && on && 'hd-catch')}
                >
                  {on && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-2xl"><Emoji e={QUEUE_EMOJI[qq]} /></span>
                  <p className="mt-2 font-semibold">{QUEUE_INFO[qq].label}</p>
                  <p className="text-xs text-muted-foreground">{QUEUE_INFO[qq].text}</p>
                  {replyTime(d?.typicalReplyMinutes ?? null) && <p className="mt-1.5 flex items-center gap-1 text-2xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Usually replies in {replyTime(d!.typicalReplyMinutes)}</p>}
                </button>
              );
            })}
          </div>

          {/* 2 · Topic */}
          {queue && topics.length > 0 && (
            <Card className="space-y-3 p-4 animate-fade-up">
              <p className="text-sm font-semibold">What is it about?</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Topic">
                {topics.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={topicId === t.id} onClick={() => pickTopic(t.id)}
                    className={cn('emo-host inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors', topicId === t.id ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:bg-subtle')}>
                    <Emoji e={t.icon ?? '🏷️'} /> {t.name}
                  </button>
                ))}
              </div>
              {topic?.description && <p className="text-xs text-muted-foreground">{topic.description}</p>}
            </Card>
          )}

          {/* 3 · Details */}
          {queue && (
            <Card className="space-y-4 p-4 animate-fade-up">
              {topic?.quickAnswer && (
                <div className="rounded-lg border border-warning/40 bg-warning-soft/50 p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-medium"><BookOpen className="h-4 w-4" /> This may fix it</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{topic.quickAnswer}</p>
                  {helped ? (
                    <p className="mt-2 text-xs font-medium text-success">Great — glad it’s sorted. <Link href="/app/helpdesk" className="underline">Back to My tickets</Link></p>
                  ) : (
                    <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => { setHelped(true); thanks.mutate(topic.id); }}><ThumbsUp /> That fixed it</Button>
                  )}
                </div>
              )}
              <Field label="Subject" htmlFor="rt-subject" required>
                <Input id="rt-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={5} maxLength={150} placeholder={PLACEHOLDER[queue]} />
              </Field>
              {topic && topic.questions.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {topic.questions.map((qq) => (
                    <Field key={qq.id} label={qq.label} htmlFor={`rt-q-${qq.id}`} required={qq.required}>
                      {qq.kind === 'choice' ? (
                        <Select id={`rt-q-${qq.id}`} className={inputClass} value={answers[qq.id] ?? ''} required={qq.required} onChange={(e) => setAnswers({ ...answers, [qq.id]: e.target.value })}>
                          <option value="">Choose…</option>
                          {(qq.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </Select>
                      ) : qq.kind === 'device' ? (
                        <Select id={`rt-q-${qq.id}`} className={inputClass} value={answers[qq.id] ?? ''} required={qq.required} onChange={(e) => setAnswers({ ...answers, [qq.id]: e.target.value })}>
                          <option value="">{devices.isLoading ? 'Loading your devices…' : devices.data?.current.length ? 'Choose one of your devices' : 'No devices on record'}</option>
                          {(devices.data?.current ?? []).map((a) => <option key={a.asset.id} value={a.asset.id}>{a.asset.tag} · {a.asset.name}</option>)}
                        </Select>
                      ) : (
                        <Input id={`rt-q-${qq.id}`} value={answers[qq.id] ?? ''} required={qq.required} maxLength={500} onChange={(e) => setAnswers({ ...answers, [qq.id]: e.target.value })} />
                      )}
                    </Field>
                  ))}
                </div>
              )}
              <Field label="Tell us more" htmlFor="rt-details" required hint="What happened, since when, and what you’ve tried.">
                <Textarea id="rt-details" rows={5} value={details} onChange={(e) => setDetails(e.target.value)} required minLength={10} maxLength={5000} />
              </Field>
              <div>
                {file ? (
                  <span className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-sm">
                    <Paperclip className="h-3.5 w-3.5" /> {file.name}
                    <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </span>
                ) : (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground">
                    <Paperclip className="h-4 w-4" /> Attach a screenshot or file
                    <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">How urgent?</p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How urgent">
                  {URGENCY.map(([p, title, text]) => (
                    <button key={p} type="button" role="radio" aria-checked={shown === p} onClick={() => setUrgency(p)}
                      className={cn('rounded-lg border px-3 py-2 text-left transition-colors', shown === p ? 'border-primary bg-primary-soft' : 'border-border hover:bg-subtle')}>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-2xs text-muted-foreground">{text} · {PRIORITY[p].label}</p>
                    </button>
                  ))}
                </div>
                {!urgency && startPriority === 'URGENT' && <p className="mt-1.5 text-xs text-warning">This topic starts as Urgent — the team treats it first.</p>}
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {hints.data && (hints.data.topics.length > 0 || hints.data.tickets.length > 0) && q.trim().length >= 3 && (
            <Card className="space-y-2 border-warning/40 p-4 animate-fade-up">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-warning" /> Before you send — these may help</p>
              {hints.data.topics.filter((t) => t.id !== topicId).map((t) => (
                <div key={t.id} className="rounded-md bg-subtle p-2.5 text-xs">
                  <p className="font-medium">{t.icon} {t.name} · {QUEUE_INFO[t.queue].label}</p>
                  <p className="mt-0.5 text-muted-foreground">{t.quickAnswer}</p>
                </div>
              ))}
              {hints.data.tickets.map((t) => (
                <Link key={t.id} href={`/app/helpdesk/${t.id}`} className="block rounded-md bg-subtle p-2.5 text-xs hover:bg-muted">
                  <p className="font-medium">🗂️ Your ticket #{t.number} · solved</p>
                  <p className="truncate text-muted-foreground">{t.subject}</p>
                </Link>
              ))}
              <p className="text-2xs text-muted-foreground">From the teams’ quick answers and your own solved tickets — never other people’s.</p>
            </Card>
          )}
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold">Who will help</p>
            {who ? (
              <>
                <div className="flex items-center gap-2.5">
                  {who.person ? <PersonAvatar person={who.person} /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xl" aria-hidden>{QUEUE_EMOJI[queue!]}</span>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{who.name}</p>
                    <p className="text-xs text-muted-foreground">{who.note}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md bg-subtle px-3 py-2 text-xs">
                  <span>First reply within <b>{hours(SLA_HOURS[priority].response)}</b><br /><span className="text-muted-foreground">Solved within {hours(SLA_HOURS[priority].resolution)}</span></span>
                  <Badge tone={PRIORITY[priority].tone}>{PRIORITY[priority].label}</Badge>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Pick a team first.</p>
            )}
            <div className="relative flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="secondary" asChild><Link href="/app/helpdesk">Cancel</Link></Button>
              <Button ref={sendRef} type="submit" loading={create.isPending} disabled={!ready || Boolean(flying)}>
                <Send /> {queue ? `Send to ${QUEUE_INFO[queue].label}` : 'Send'}
              </Button>
              {flying && (
                <span aria-hidden className="hd-plane pointer-events-none absolute bottom-2 right-10 z-50 text-2xl" style={{ ['--hd-x' as string]: `${flying.x}px`, ['--hd-y' as string]: `${flying.y}px` }}>✈️</span>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </form>
  );
}

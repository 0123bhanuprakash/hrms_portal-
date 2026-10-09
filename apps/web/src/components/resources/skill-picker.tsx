'use client';

import React, { useMemo, useState } from 'react';
import { Check, Plus, Search, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/cn';

/** Common skills by area, so a new company has something to pick from. */
export const SKILL_CATALOG: Array<{ area: string; skills: string[] }> = [
  { area: 'Frontend', skills: ['React', 'Next.js', 'Angular', 'Vue', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Tailwind CSS', 'Redux', 'Accessibility'] },
  { area: 'Backend', skills: ['Node.js', 'NestJS', 'Express', 'Java', 'Spring Boot', 'Python', 'Django', 'FastAPI', '.NET', 'C#', 'Go', 'PHP', 'Ruby on Rails', 'GraphQL', 'REST APIs', 'Microservices'] },
  { area: 'Mobile', skills: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Android', 'iOS'] },
  { area: 'Data & AI', skills: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Power BI', 'Tableau', 'Data analysis', 'Machine learning', 'LLMs', 'Pandas', 'Spark'] },
  { area: 'Cloud & DevOps', skills: ['AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'GitHub Actions', 'Jenkins', 'Linux', 'Monitoring'] },
  { area: 'Testing', skills: ['Manual testing', 'Test automation', 'Selenium', 'Cypress', 'Playwright', 'Jest', 'Performance testing', 'API testing'] },
  { area: 'Design', skills: ['Figma', 'UI design', 'UX research', 'Prototyping', 'Design systems', 'Illustrator', 'Photoshop'] },
  { area: 'Product & delivery', skills: ['Product management', 'Agile', 'Scrum', 'Jira', 'Business analysis', 'Requirements', 'Stakeholder management', 'Technical writing'] },
  { area: 'Security', skills: ['Application security', 'VAPT', 'ISO 27001', 'SIEM', 'IAM', 'Network security'] },
  { area: 'Business', skills: ['Sales', 'Customer success', 'Recruitment', 'Payroll', 'Accounting', 'Excel', 'Communication'] },
];

const low = (s: string) => s.trim().toLowerCase();

/**
 * Pick skills from a searchable list: what people in the company already use
 * first, then common skills by area. Anything not listed can be added as typed.
 */
export function SkillPickerDialog({ have, suggestions, max = 40, saving, onAdd, onClose }: { have: string[]; suggestions: string[]; max?: number; saving?: boolean; onAdd: (skills: string[]) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const owned = useMemo(() => new Set(have.map(low)), [have]);
  const room = Math.max(0, max - have.length);
  const isPicked = (s: string) => picked.some((p) => low(p) === low(s));
  const toggle = (s: string) => setPicked((cur) => (isPicked(s) ? cur.filter((p) => low(p) !== low(s)) : cur.length >= room ? cur : [...cur, s.trim()]));
  const term = low(q);
  const match = (s: string) => !term || low(s).includes(term);

  // Company first, then the catalogue (each skill once)
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const take = (list: string[]) => list.filter((s) => (seen.has(low(s)) ? false : (seen.add(low(s)), true)));
    return [
      { area: 'Used in your company', skills: take(suggestions.slice(0, 40)) },
      ...SKILL_CATALOG.map((g) => ({ area: g.area, skills: take(g.skills) })),
    ].filter((g) => g.skills.length);
  }, [suggestions]);
  const shown = groups.map((g) => ({ ...g, skills: g.skills.filter(match) })).filter((g) => g.skills.length);
  const known = groups.some((g) => g.skills.some((s) => low(s) === term)) || owned.has(term) || isPicked(q);
  const canCustom = term.length >= 2 && term.length <= 40 && !known;

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      icon={<Sparkles />}
      title="Add skills"
      description={room ? 'Pick as many as you like, then add them. Search, or type one that isn’t listed.' : `You already have ${max} skills — remove some first.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button loading={saving} disabled={!picked.length} onClick={() => onAdd(picked)}>
            <Plus /> {picked.length ? `Add ${picked.length} skill${picked.length === 1 ? '' : 's'}` : 'Add skills'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              // Enter picks the only match, or adds what was typed
              const only = shown.length === 1 && shown[0]!.skills.length === 1 ? shown[0]!.skills[0]! : null;
              if (only && !owned.has(low(only))) toggle(only);
              else if (canCustom) toggle(q);
              setQ('');
            }}
            placeholder="Search skills, e.g. React, Figma, AWS"
            className="pl-9"
            aria-label="Search skills"
          />
        </div>

        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-primary-soft/40 p-2">
            <span className="mr-1 text-xs font-medium text-muted-foreground">To add:</span>
            {picked.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                {s}
                <button type="button" aria-label={`Don’t add ${s}`} onClick={() => toggle(s)} className="rounded-full opacity-80 hover:opacity-100"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}

        <div className="h-[22rem] space-y-3 overflow-y-auto pr-1">
          {canCustom && (
            <button type="button" onClick={() => { toggle(q); setQ(''); }} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-primary/50 px-3 py-2 text-left text-sm text-primary hover:bg-primary-soft/40">
              <Plus className="h-4 w-4" /> Add “{q.trim()}” as a new skill
            </button>
          )}
          {shown.map((g) => (
            <section key={g.area} className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.area}</h3>
              <div className="flex flex-wrap gap-1.5">
                {g.skills.map((s) => {
                  const mine = owned.has(low(s));
                  const on = isPicked(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={mine || (!on && picked.length >= room)}
                      aria-pressed={on}
                      onClick={() => toggle(s)}
                      title={mine ? 'Already on your profile' : undefined}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        on ? 'border-primary bg-primary text-primary-foreground' : mine ? 'cursor-default border-success/40 bg-success-soft/50 text-success' : 'border-border hover:border-primary/50 hover:bg-subtle disabled:opacity-40',
                      )}
                    >
                      {(on || mine) && <Check className="h-3 w-3" />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {!shown.length && !canCustom && <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</p>}
        </div>
      </div>
    </Modal>
  );
}

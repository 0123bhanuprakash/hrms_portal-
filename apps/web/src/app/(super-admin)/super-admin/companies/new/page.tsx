'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  Mail,
  Moon,
  Palette,
  PartyPopper,
  Plus,
  Sun,
  UserCog,
} from 'lucide-react';
import type { ThemeRef } from '@hrms/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/feedback';
import { ColorInput, Field, Input, inputClass } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { ThemePicker } from '@/components/theme/theme-picker';
import { formatLimit, usePlans } from '@/lib/admin/plans';
import { ThemePreviewFrame } from '@/components/theme/theme-preview-frame';
import { ThemeSwatches } from '@/components/theme/theme-card';
import { useCreateCompany, useThemeSettings } from '@/lib/admin/queries';
import type { Company, CreateCompanyInput } from '@/lib/admin/types';
import { useThemeLibrary } from '@/lib/theme/library';
import { DEFAULT_PRESET } from '@/lib/theme/presets';
import { rebrandTheme } from '@/lib/theme/generate';
import { getApiErrorMessage } from '@/lib/errors';
import { slugify } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

const STEPS = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'admin', label: 'First admin', icon: UserCog },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[0-9A-F]{6}$/i;

type Form = Pick<
  Required<CreateCompanyInput>,
  'name' | 'slug' | 'email' | 'employeeIdPrefix' | 'adminEmail' | 'adminFirstName' | 'adminLastName'
>;

const EMPTY: Form = {
  name: '',
  slug: '',
  email: '',
  employeeIdPrefix: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
};

interface ThemeChoice {
  ref: ThemeRef | null;
  /** Restyle the chosen theme with the company's own brand color */
  useBrand: boolean;
  brandColor: string;
}

/** "Acme Test Co" → "ATC", "Globex" → "GLO" */
function suggestPrefix(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const value = words.length === 1 ? words[0]!.slice(0, 3) : words.map((w) => w[0]).join('').slice(0, 4);
  return value.length >= 2 ? value : value.padEnd(2, 'X');
}

function validate(step: number, f: Form, theme: ThemeChoice): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    if (!f.name.trim()) e.name = 'Company name is required';
    if (!/^[a-z0-9-]{2,50}$/.test(f.slug)) e.slug = '2–50 lowercase letters, numbers or hyphens';
    if (!EMAIL_RE.test(f.email)) e.email = 'Enter a valid email address';
    if (!/^[A-Z0-9]{2,10}$/.test(f.employeeIdPrefix)) e.employeeIdPrefix = '2–10 uppercase letters or digits';
  }
  if (step === 1) {
    if (!theme.ref) e.theme = 'Choose a theme';
    if (theme.useBrand && !HEX_RE.test(theme.brandColor)) e.brandColor = 'Use a hex color like #4F46E5';
  }
  if (step === 2) {
    if (!f.adminFirstName.trim()) e.adminFirstName = 'First name is required';
    if (!f.adminLastName.trim()) e.adminLastName = 'Last name is required';
    if (!EMAIL_RE.test(f.adminEmail)) e.adminEmail = 'Enter a valid email address';
  }
  return e;
}

export default function OnboardCompanyPage() {
  const router = useRouter();
  const create = useCreateCompany();
  const settings = useThemeSettings();
  const library = useThemeLibrary();
  const plans = usePlans();
  const [planId, setPlanId] = useState('');
  const activePlans = (plans.data ?? []).filter((p) => p.isActive);
  const plan = activePlans.find((p) => p.id === planId);
  // Preselect the default plan (Enterprise) once plans load
  useEffect(() => {
    if (!planId && activePlans.length) setPlanId((activePlans.find((p) => p.key === 'enterprise') ?? activePlans[0]!).id);
  }, [planId, activePlans]);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [theme, setTheme] = useState<ThemeChoice>({ ref: null, useBrand: false, brandColor: '#4F46E5' });
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [slugEdited, setSlugEdited] = useState(false);
  const [prefixEdited, setPrefixEdited] = useState(false);
  const [created, setCreated] = useState<Company | null>(null);

  // Preselect the platform's default theme for new companies
  useEffect(() => {
    if (!theme.ref && settings.data) setTheme((t) => ({ ...t, ref: settings.data.defaultCompanyTheme }));
  }, [settings.data, theme.ref]);

  const selected = library.find(theme.ref);
  const baseTokens = selected?.tokens ?? DEFAULT_PRESET.tokens;
  const tokens = useMemo(
    () => (theme.useBrand && HEX_RE.test(theme.brandColor) ? rebrandTheme(baseTokens, theme.brandColor) : baseTokens),
    [baseTokens, theme.useBrand, theme.brandColor],
  );

  const errors = touched.has(step) ? validate(step, form, theme) : {};
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onNameChange = (name: string) =>
    setForm((f) => ({
      ...f,
      name,
      slug: slugEdited ? f.slug : slugify(name),
      employeeIdPrefix: prefixEdited ? f.employeeIdPrefix : suggestPrefix(name),
    }));

  const next = () => {
    setTouched((t) => new Set(t).add(step));
    if (Object.keys(validate(step, form, theme)).length === 0) setStep((s) => s + 1);
  };

  const reset = () => {
    setCreated(null);
    setForm(EMPTY);
    setTheme({ ref: settings.data?.defaultCompanyTheme ?? null, useBrand: false, brandColor: '#4F46E5' });
    setStep(0);
    setTouched(new Set());
    setSlugEdited(false);
    setPrefixEdited(false);
  };

  const submit = async () => {
    try {
      const result = await create.mutateAsync({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminFirstName: form.adminFirstName.trim(),
        adminLastName: form.adminLastName.trim(),
        themeTokens: tokens,
        themeSource: theme.ref ?? undefined,
        ...(planId && { planId }),
      });
      setCreated(result.company);
      toast.success(`${result.company.name} is live`);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to create company');
      toast.error(message);
      // Send the user back to the step that owns the conflicting field
      if (/slug|company email/i.test(message)) setStep(0);
      else if (/user with email|user email/i.test(message)) setStep(2);
    }
  };

  if (created) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center animate-scale-in">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success-soft text-success">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{created.name} is ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Themed with <b>{selected?.name ?? 'the default theme'}</b>
          {theme.useBrand && ' in their brand color'}. A welcome email with a temporary password was sent to <b>{form.adminEmail}</b>.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => router.push(`/super-admin/companies/${created.id}`)} icon={<Building2 />}>
            Open company
          </Button>
          <Button variant="secondary" icon={<Plus />} onClick={reset}>
            Onboard another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/super-admin/companies" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Companies
          </Link>
        }
        title="Onboard a company"
        description="Create the tenant, give it a ready-made theme, and invite its first Company Admin."
      />

      {/* Stepper */}
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map(({ id, label, icon: Icon }, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={id}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => i < step && setStep(i)}
                className="group flex w-full flex-col gap-2 text-left disabled:cursor-default"
              >
                <span className={cn('h-1 rounded-full transition-colors duration-300', done || current ? 'bg-primary' : 'bg-muted')} />
                <span className={cn('flex items-center gap-2 text-xs font-medium', current ? 'text-primary' : done ? 'text-foreground group-hover:text-primary' : 'text-muted-foreground')}>
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', done ? 'bg-primary text-primary-foreground' : current ? 'bg-primary-soft' : 'bg-muted')}>
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <div key={step} className="animate-fade-up space-y-5">
            {step === 0 && (
              <>
                <StepTitle title="Company details" subtitle="Basic information about the tenant." />
                <Field label="Company name" htmlFor="name" required error={errors.name}>
                  <Input id="name" autoFocus value={form.name} invalid={!!errors.name} onChange={(e) => onNameChange(e.target.value)} placeholder="Acme Corporation" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="URL slug" htmlFor="slug" required error={errors.slug} hint={<>Login: <code>/login?company={form.slug || 'acme'}</code></>}>
                    <Input id="slug" value={form.slug} invalid={!!errors.slug} className="font-mono" onChange={(e) => { setSlugEdited(true); set('slug', slugify(e.target.value)); }} placeholder="acme" />
                  </Field>
                  <Field label="Employee ID prefix" htmlFor="prefix" required error={errors.employeeIdPrefix} hint={`First ID: ${form.employeeIdPrefix || 'EMP'}001`}>
                    <Input
                      id="prefix"
                      value={form.employeeIdPrefix}
                      maxLength={10}
                      invalid={!!errors.employeeIdPrefix}
                      className="font-mono uppercase"
                      onChange={(e) => { setPrefixEdited(true); set('employeeIdPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); }}
                      placeholder="ACM"
                    />
                  </Field>
                </div>
                <Field label="Company contact email" htmlFor="email" required error={errors.email}>
                  <Input id="email" type="email" value={form.email} invalid={!!errors.email} onChange={(e) => set('email', e.target.value)} placeholder="hr@acme.com" />
                </Field>
                <Field
                  label="Plan"
                  htmlFor="plan"
                  hint={plan ? `${plan.features.length} features · ${formatLimit(plan.limits.maxEmployees)} employees — change anytime on the company's Plan & features tab` : 'Decides which features the company can use'}
                >
                  <Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
                    {activePlans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.description ? ` — ${p.description}` : ''}</option>
                    ))}
                  </Select>
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <StepTitle
                  title="Choose a theme"
                  subtitle="The company starts with this look. Their Company Admin can customize it later."
                />
                {errors.theme && <p className="text-xs font-medium text-destructive">{errors.theme}</p>}
                <div className="max-h-[440px] overflow-y-auto pr-1">
                  <ThemePicker items={library.items} value={theme.ref} onChange={(item) => setTheme((t) => ({ ...t, ref: item.ref }))} columns={2} />
                </div>
                <div className="rounded-lg border border-border p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={theme.useBrand}
                      onChange={(e) => setTheme((t) => ({ ...t, useBrand: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <span>
                      <span className="block text-[13px] font-medium">Use the company&apos;s brand color</span>
                      <span className="block text-xs text-muted-foreground">Keeps the theme&apos;s style (sidebar, font, shapes) and recolors it.</span>
                    </span>
                  </label>
                  {theme.useBrand && (
                    <div className="mt-3 animate-in fade-in-0">
                      <Field label="Brand color" htmlFor="brand" error={errors.brandColor}>
                        <ColorInput id="brand" value={theme.brandColor} onChange={(v) => setTheme((t) => ({ ...t, brandColor: v }))} />
                      </Field>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <StepTitle title="First Company Admin" subtitle="This person gets full access to the company portal and receives a welcome email with a temporary password." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" htmlFor="afn" required error={errors.adminFirstName}>
                    <Input id="afn" autoFocus value={form.adminFirstName} invalid={!!errors.adminFirstName} onChange={(e) => set('adminFirstName', e.target.value)} />
                  </Field>
                  <Field label="Last name" htmlFor="aln" required error={errors.adminLastName}>
                    <Input id="aln" value={form.adminLastName} invalid={!!errors.adminLastName} onChange={(e) => set('adminLastName', e.target.value)} />
                  </Field>
                </div>
                <Field label="Work email" htmlFor="aem" required error={errors.adminEmail}>
                  <Input id="aem" type="email" value={form.adminEmail} invalid={!!errors.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} placeholder="jane@acme.com" />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <StepTitle title="Review & create" subtitle="Check everything before the company goes live." />
                <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                  <CompanyAvatar name={form.name} color={tokens.light.primary} />
                  <div className="min-w-0">
                    <p className="font-semibold">{form.name}</p>
                    <p className="text-xs text-muted-foreground">{form.slug} · {form.email}</p>
                  </div>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <ReviewItem label="Employee IDs" value={`${form.employeeIdPrefix}001, ${form.employeeIdPrefix}002, …`} onEdit={() => setStep(0)} />
                  <ReviewItem label="Plan" value={plan ? `${plan.name} · ${formatLimit(plan.limits.maxEmployees)} employees` : 'Default'} onEdit={() => setStep(0)} />
                  <ReviewItem
                    label="Theme"
                    value={
                      <span className="flex items-center gap-2">
                        <ThemeSwatches tokens={tokens} />
                        <span className="truncate">{selected?.name ?? 'Default'}{theme.useBrand ? ' · brand color' : ''}</span>
                      </span>
                    }
                    onEdit={() => setStep(1)}
                  />
                  <ReviewItem label="Company Admin" value={`${form.adminFirstName} ${form.adminLastName}`} onEdit={() => setStep(2)} />
                  <ReviewItem label="Admin email" value={form.adminEmail} onEdit={() => setStep(2)} />
                </dl>
                <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  A welcome email with sign-in details will be sent to {form.adminEmail} as soon as you create the company.
                </p>
              </>
            )}
          </div>

          <div className="mt-8 flex justify-between border-t border-border pt-5">
            <Button variant="ghost" icon={<ArrowLeft />} disabled={step === 0 || create.isPending} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button variant="success" onClick={submit} loading={create.isPending} icon={<Check />}>
                Create company
              </Button>
            )}
          </div>
        </Card>

        {/* Live preview of the company portal, visible on every step */}
        <div className="space-y-2 lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live preview{selected ? ` · ${selected.name}` : ''}
            </p>
            <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
              {(['light', 'dark'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-label={`${m} preview`}
                  aria-pressed={previewMode === m}
                  onClick={() => setPreviewMode(m)}
                  className={cn('flex h-6 w-7 items-center justify-center rounded-[calc(var(--radius)-4px)] text-muted-foreground', previewMode === m && 'bg-surface text-foreground shadow-card')}
                >
                  {m === 'light' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>
          <Card className="overflow-hidden">
            <ThemePreviewFrame tokens={tokens} mode={previewMode} page="dashboard" companyName={form.name} height={520} className="p-3" />
          </Card>
          <p className="text-xs text-muted-foreground">This is how the company portal will look to its employees.</p>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ReviewItem({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="group rounded-lg bg-muted p-3">
      <dt className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <button type="button" onClick={onEdit} className="text-primary opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
          Edit
        </button>
      </dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
    </div>
  );
}

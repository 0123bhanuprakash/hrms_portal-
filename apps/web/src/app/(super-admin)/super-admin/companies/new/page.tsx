'use client';

import React, { useState } from 'react';
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
  Palette,
  PartyPopper,
  Plus,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/feedback';
import { ColorInput, Field, Input } from '@/components/ui/field';
import { BrandPreview } from '@/components/super-admin/brand-preview';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { useCreateCompany } from '@/lib/admin/queries';
import type { Company, CreateCompanyInput } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { slugify } from '@/lib/format';
import { cn } from '@/lib/cn';

const STEPS = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'admin', label: 'First admin', icon: UserCog },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[0-9A-F]{6}$/i;
const PRESETS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#7C3AED', '#0F172A'];

type Form = Required<CreateCompanyInput>;

const EMPTY: Form = {
  name: '',
  slug: '',
  email: '',
  employeeIdPrefix: '',
  primaryColor: '#4F46E5',
  secondaryColor: '#EEF2FF',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
};

/** "Acme Test Co" → "ATC", "Globex" → "GLO" */
function suggestPrefix(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const value = words.length === 1 ? words[0]!.slice(0, 3) : words.map((w) => w[0]).join('').slice(0, 4);
  return value.length >= 2 ? value : value.padEnd(2, 'X');
}

function validate(step: number, f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (step === 0) {
    if (!f.name.trim()) e.name = 'Company name is required';
    if (!/^[a-z0-9-]{2,50}$/.test(f.slug)) e.slug = '2–50 lowercase letters, numbers or hyphens';
    if (!EMAIL_RE.test(f.email)) e.email = 'Enter a valid email address';
    if (!/^[A-Z0-9]{2,10}$/.test(f.employeeIdPrefix)) e.employeeIdPrefix = '2–10 uppercase letters or digits';
  }
  if (step === 1) {
    if (!HEX_RE.test(f.primaryColor)) e.primaryColor = 'Use a hex color like #4F46E5';
    if (!HEX_RE.test(f.secondaryColor)) e.secondaryColor = 'Use a hex color like #EEF2FF';
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
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [slugEdited, setSlugEdited] = useState(false);
  const [prefixEdited, setPrefixEdited] = useState(false);
  const [created, setCreated] = useState<Company | null>(null);

  const errors = touched.has(step) ? validate(step, form) : {};
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
    if (Object.keys(validate(step, form)).length === 0) setStep((s) => s + 1);
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
      });
      setCreated(result.company);
      toast.success(`${result.company.name} is live`);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to create company');
      toast.error(message);
      // Send the user back to the step that owns the conflicting field
      if (/slug|company email/i.test(message)) setStep(0);
      else if (/user with email/i.test(message)) setStep(2);
    }
  };

  if (created) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center animate-scale-in">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success-soft text-success">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold">{created.name} is ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A welcome email with a temporary password was sent to <b>{form.adminEmail}</b>.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => router.push(`/super-admin/companies/${created.id}`)} icon={<Building2 className="h-4 w-4" />}>
            Open company
          </Button>
          <Button
            variant="secondary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setCreated(null);
              setForm(EMPTY);
              setStep(0);
              setTouched(new Set());
              setSlugEdited(false);
              setPrefixEdited(false);
            }}
          >
            Onboard another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/super-admin/companies" className="rounded-lg p-2 text-muted-foreground hover:bg-subtle" aria-label="Back to companies">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboard a company</h1>
          <p className="text-sm text-muted-foreground">Create the tenant, its branding and the first Company Admin.</p>
        </div>
      </div>

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
                <span className={cn('h-1.5 rounded-full transition-colors duration-300', done || current ? 'bg-primary' : 'bg-muted')} />
                <span className={cn('flex items-center gap-2 text-xs font-medium', current ? 'text-primary' : done ? 'text-foreground group-hover:text-primary' : 'text-muted-foreground')}>
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', done ? 'bg-primary text-white' : current ? 'bg-primary-soft' : 'bg-muted')}>
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
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
              </>
            )}

            {step === 1 && (
              <>
                <StepTitle title="Brand colors" subtitle="Used across the company portal and emails. The admin can upload a logo later." />
                <Field label="Primary color" htmlFor="primary" error={errors.primaryColor}>
                  <ColorInput id="primary" value={form.primaryColor} onChange={(v) => set('primaryColor', v)} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('primaryColor', c)}
                      aria-label={`Use ${c}`}
                      className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110', form.primaryColor === c && 'ring-2 ring-foreground')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <Field label="Secondary color" htmlFor="secondary" error={errors.secondaryColor}>
                  <ColorInput id="secondary" value={form.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
                </Field>
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
                <div className="flex items-center gap-3 rounded-xl border border-border p-4">
                  <CompanyAvatar name={form.name} color={form.primaryColor} />
                  <div className="min-w-0">
                    <p className="font-semibold">{form.name}</p>
                    <p className="text-xs text-muted-foreground">{form.slug} · {form.email}</p>
                  </div>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <ReviewItem label="Employee IDs" value={`${form.employeeIdPrefix}001, ${form.employeeIdPrefix}002, …`} onEdit={() => setStep(0)} />
                  <ReviewItem
                    label="Colors"
                    value={
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: form.primaryColor }} />
                        <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: form.secondaryColor }} />
                        <code className="text-xs">{form.primaryColor}</code>
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
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} disabled={step === 0 || create.isPending} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="success" onClick={submit} loading={create.isPending} icon={<Check className="h-4 w-4" />}>
                Create company
              </Button>
            )}
          </div>
        </Card>

        {/* Live preview, visible on every step */}
        <div className="space-y-3 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
          <BrandPreview name={form.name} primaryColor={form.primaryColor} secondaryColor={form.secondaryColor} />
          <p className="text-xs text-muted-foreground">This is roughly how the company portal will look to its employees.</p>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ReviewItem({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="group rounded-lg bg-muted p-3">
      <dt className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <button type="button" onClick={onEdit} className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Edit
        </button>
      </dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
    </div>
  );
}

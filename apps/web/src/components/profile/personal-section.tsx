'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Cake, HeartPulse, Home, Pencil, Phone, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import {
  BLOOD_GROUPS,
  MARITAL_STATUSES,
  useUpdatePersonal,
  type Address,
  type PersonalInput,
  type PrivateProfile,
} from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

const pretty = (s: string | null | undefined) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : null);
const addressText = (a: Address | null | undefined) =>
  a ? [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', '), a.postalCode, a.country].filter(Boolean).join(', ') || null : null;

/** Label / value grid used by the profile sections. */
export function InfoGrid({ rows }: { rows: Array<[label: string, value: React.ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 px-5 pb-5 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-words text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PersonalSection({ employeeId, data, isSelf }: { employeeId: string; data: PrivateProfile; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const p = data.personal;
  const edit = data.canEdit && (
    <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
      <Pencil /> Edit
    </Button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader icon={<UserRound />} title="Personal" action={edit} />
        <InfoGrid
          rows={[
            ['Phone', data.phone],
            ['Personal email', p?.personalEmail],
            ['Date of birth', data.dateOfBirth && formatDate(data.dateOfBirth)],
            ['Gender', pretty(data.gender)],
            ['Blood group', p?.bloodGroup],
            ['Marital status', pretty(p?.maritalStatus)],
          ]}
        />
        <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <Cake className="h-3.5 w-3.5" />
          {data.showBirthday ? 'Birthday (day and month) is shown to colleagues in Spotlight.' : 'Birthday is hidden from colleagues.'}
        </p>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader icon={<Home />} title="Address" />
          <InfoGrid rows={[['Current address', addressText(p?.currentAddress)], ['Permanent address', addressText(p?.permanentAddress)]]} />
        </Card>
        <Card>
          <CardHeader icon={<HeartPulse />} title="Emergency contact" />
          <InfoGrid
            rows={[
              ['Name', p?.emergencyContactName && `${p.emergencyContactName}${p.emergencyContactRelation ? ` (${p.emergencyContactRelation})` : ''}`],
              ['Phone', p?.emergencyContactPhone && (
                <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${p.emergencyContactPhone}`}>
                  <Phone className="h-3.5 w-3.5" /> {p.emergencyContactPhone}
                </a>
              )],
            ]}
          />
        </Card>
      </div>

      <PersonalDialog open={editing} onClose={() => setEditing(false)} employeeId={employeeId} data={data} isSelf={isSelf} />
    </div>
  );
}

// ─── Edit dialog ────────────────────────────────────────────

interface Form {
  phone: string;
  personalEmail: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  showBirthday: boolean;
  current: Required<{ [K in keyof Address]: string }>;
  permanent: Required<{ [K in keyof Address]: string }>;
  sameAddress: boolean;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
}

const toForm = (a: Address | null | undefined) => ({
  line1: a?.line1 ?? '',
  line2: a?.line2 ?? '',
  city: a?.city ?? '',
  state: a?.state ?? '',
  postalCode: a?.postalCode ?? '',
  country: a?.country ?? 'India',
});

/** Only a country (the default) counts as no address. */
const filled = (a: Form['current']): Address | null => (a.line1 || a.line2 || a.city || a.state || a.postalCode ? a : null);

function PersonalDialog({ open, onClose, employeeId, data, isSelf }: { open: boolean; onClose: () => void; employeeId: string; data: PrivateProfile; isSelf: boolean }) {
  const save = useUpdatePersonal(employeeId);
  const [f, setF] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const p = data.personal;
    const current = toForm(p?.currentAddress);
    const permanent = toForm(p?.permanentAddress);
    setError(null);
    setF({
      phone: data.phone ?? '',
      personalEmail: p?.personalEmail ?? '',
      dateOfBirth: data.dateOfBirth?.slice(0, 10) ?? '',
      gender: data.gender ?? '',
      bloodGroup: p?.bloodGroup ?? '',
      maritalStatus: p?.maritalStatus ?? '',
      showBirthday: data.showBirthday,
      current,
      permanent,
      sameAddress: Boolean(p?.currentAddress) && JSON.stringify(current) === JSON.stringify(permanent),
      emergencyContactName: p?.emergencyContactName ?? '',
      emergencyContactRelation: p?.emergencyContactRelation ?? '',
      emergencyContactPhone: p?.emergencyContactPhone ?? '',
    });
  }, [open, data]);

  if (!f) return null;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((prev) => (prev ? { ...prev, [key]: value } : prev));
  const setAddr = (which: 'current' | 'permanent', key: keyof Address, value: string) =>
    setF((prev) => (prev ? { ...prev, [which]: { ...prev[which], [key]: value } } : prev));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: PersonalInput = {
      phone: f.phone,
      personalEmail: f.personalEmail,
      dateOfBirth: f.dateOfBirth || null,
      gender: f.gender || null,
      bloodGroup: f.bloodGroup,
      maritalStatus: f.maritalStatus,
      showBirthday: f.showBirthday,
      currentAddress: filled(f.current),
      permanentAddress: filled(f.sameAddress ? f.current : f.permanent),
      emergencyContactName: f.emergencyContactName,
      emergencyContactRelation: f.emergencyContactRelation,
      emergencyContactPhone: f.emergencyContactPhone,
    };
    try {
      await save.mutateAsync(body);
      toast.success('Personal details saved');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save personal details'));
    }
  };

  const addressFields = (which: 'current' | 'permanent') => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Address line 1" htmlFor={`${which}-l1`} className="sm:col-span-2">
        <Input id={`${which}-l1`} value={f[which].line1} onChange={(e) => setAddr(which, 'line1', e.target.value)} maxLength={120} />
      </Field>
      <Field label="Address line 2" htmlFor={`${which}-l2`} className="sm:col-span-2">
        <Input id={`${which}-l2`} value={f[which].line2} onChange={(e) => setAddr(which, 'line2', e.target.value)} maxLength={120} />
      </Field>
      <Field label="City" htmlFor={`${which}-city`}>
        <Input id={`${which}-city`} value={f[which].city} onChange={(e) => setAddr(which, 'city', e.target.value)} maxLength={60} />
      </Field>
      <Field label="State" htmlFor={`${which}-state`}>
        <Input id={`${which}-state`} value={f[which].state} onChange={(e) => setAddr(which, 'state', e.target.value)} maxLength={60} />
      </Field>
      <Field label="PIN code" htmlFor={`${which}-pin`}>
        <Input id={`${which}-pin`} value={f[which].postalCode} onChange={(e) => setAddr(which, 'postalCode', e.target.value)} maxLength={12} inputMode="numeric" />
      </Field>
      <Field label="Country" htmlFor={`${which}-country`}>
        <Input id={`${which}-country`} value={f[which].country} onChange={(e) => setAddr(which, 'country', e.target.value)} maxLength={60} />
      </Field>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={save.isPending}
      icon={<UserRound />}
      title={isSelf ? 'Edit your personal details' : 'Edit personal details'}
      description="Visible only to you and to people with permission to see personal details."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="personal-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="personal-form" onSubmit={submit} className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" htmlFor="pd-phone">
            <Input id="pd-phone" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} />
          </Field>
          <Field label="Personal email" htmlFor="pd-email">
            <Input id="pd-email" type="email" value={f.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} maxLength={200} />
          </Field>
          <Field label="Date of birth" htmlFor="pd-dob">
            <Input id="pd-dob" type="date" value={f.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </Field>
          <Field label="Gender" htmlFor="pd-gender">
            <select id="pd-gender" className={inputClass} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">Not set</option>
              {['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].map((g) => <option key={g} value={g}>{pretty(g)}</option>)}
            </select>
          </Field>
          <Field label="Blood group" htmlFor="pd-blood">
            <select id="pd-blood" className={inputClass} value={f.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
              <option value="">Not set</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Marital status" htmlFor="pd-marital">
            <select id="pd-marital" className={inputClass} value={f.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
              <option value="">Not set</option>
              {MARITAL_STATUSES.map((m) => <option key={m} value={m}>{pretty(m)}</option>)}
            </select>
          </Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f.showBirthday} onChange={(e) => set('showBirthday', e.target.checked)} />
            <span>
              <span className="font-medium">Show my birthday to colleagues</span>
              <span className="block text-xs text-muted-foreground">Only the day and month appear in Spotlight — never the year.</span>
            </span>
          </label>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Current address</h3>
          {addressFields('current')}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.sameAddress} onChange={(e) => set('sameAddress', e.target.checked)} />
            Permanent address is the same
          </label>
          {!f.sameAddress && (
            <>
              <h3 className="pt-1 text-sm font-semibold">Permanent address</h3>
              {addressFields('permanent')}
            </>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Emergency contact</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" htmlFor="pd-ec-name">
              <Input id="pd-ec-name" value={f.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} maxLength={100} />
            </Field>
            <Field label="Relationship" htmlFor="pd-ec-rel">
              <Input id="pd-ec-rel" value={f.emergencyContactRelation} onChange={(e) => set('emergencyContactRelation', e.target.value)} maxLength={40} placeholder="e.g. Spouse" />
            </Field>
            <Field label="Phone" htmlFor="pd-ec-phone">
              <Input id="pd-ec-phone" type="tel" value={f.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} maxLength={40} />
            </Field>
          </div>
        </section>
      </form>
    </Modal>
  );
}

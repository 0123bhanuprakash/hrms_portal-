'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Fingerprint, Landmark, Lock, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/feedback';
import { Field, Input, inputClass, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { InfoGrid } from '@/components/profile/personal-section';
import { revealPrivate, useUpdateBank, useUpdateStatutory, type PrivateProfile } from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';
import { Select } from '@/components/ui/pickers';

const REVEAL_SECONDS = 30;
const mono = (v: string | null | undefined) => v && <span className="font-mono tracking-wide">{v}</span>;

/** Bank account + government IDs. Numbers are masked; "Show" fetches them once (audited) for 30 s. */
export function BankIdsSection({ employeeId, data, isSelf }: { employeeId: string; data: PrivateProfile; isSelf: boolean }) {
  const [revealed, setRevealed] = useState<{ pan: string | null; accountNumber: string | null } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [editing, setEditing] = useState<'bank' | 'ids' | null>(null);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(null), REVEAL_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [revealed]);
  useEffect(() => setRevealed(null), [data]);

  const toggleReveal = async () => {
    if (revealed) return setRevealed(null);
    setRevealing(true);
    try {
      setRevealed(await revealPrivate(employeeId));
      if (!isSelf) toast.info('Viewing full numbers is recorded in the audit log');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not show the full numbers'));
    } finally {
      setRevealing(false);
    }
  };

  const hasSecrets = Boolean(data.bank || data.statutory?.panMasked);
  const revealButton = hasSecrets && (
    <Button size="sm" variant="ghost" onClick={toggleReveal} loading={revealing}>
      {revealed ? <EyeOff /> : <Eye />} {revealed ? 'Hide' : 'Show full numbers'}
    </Button>
  );
  const s = data.statutory;

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-border bg-subtle/60 px-4 py-3 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Account numbers and PAN are encrypted. Only the last 4 digits of Aadhaar are ever stored. Numbers stay masked unless you choose to show them
        {isSelf ? '.' : ' — and that is recorded in the audit log.'}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Landmark />}
            title="Bank account"
            description="Used for salary payments"
            action={
              <div className="flex gap-1">
                {revealButton}
                {data.canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => setEditing('bank')}>
                    {data.bank ? <><Pencil /> Edit</> : <><Plus /> Add</>}
                  </Button>
                )}
              </div>
            }
          />
          {data.bank ? (
            <InfoGrid
              rows={[
                ['Account holder', data.bank.accountHolderName],
                ['Account number', mono(revealed?.accountNumber ?? data.bank.accountNumberMasked)],
                ['IFSC', mono(data.bank.ifscCode)],
                ['Bank', [data.bank.bankName, data.bank.branchName].filter(Boolean).join(' · ')],
              ]}
            />
          ) : (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No bank account added yet.</p>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={<Fingerprint />}
            title="Government IDs"
            description="PAN, Aadhaar and PF / ESI numbers"
            action={
              data.canEdit && (
                <Button size="sm" variant="secondary" onClick={() => setEditing('ids')}>
                  {s ? <><Pencil /> Edit</> : <><Plus /> Add</>}
                </Button>
              )
            }
          />
          <InfoGrid
            rows={[
              ['PAN', mono(revealed?.pan ?? s?.panMasked)],
              ['Aadhaar', mono(s?.aadhaarMasked)],
              ['UAN (PF)', mono(s?.uan)],
              ['PF account number', mono(s?.pfAccountNo)],
              ['ESIC number', mono(s?.esicNumber)],
              ['Tax regime', s ? (s.taxRegime === 'NEW' ? 'New regime' : 'Old regime') : null],
            ]}
          />
        </Card>
      </div>

      <BankDialog open={editing === 'bank'} onClose={() => setEditing(null)} employeeId={employeeId} data={data} />
      <IdsDialog open={editing === 'ids'} onClose={() => setEditing(null)} employeeId={employeeId} data={data} />
    </div>
  );
}

// ─── Bank dialog ────────────────────────────────────────────

function BankDialog({ open, onClose, employeeId, data }: { open: boolean; onClose: () => void; employeeId: string; data: PrivateProfile }) {
  const save = useUpdateBank(employeeId);
  const [f, setF] = useState({ accountHolderName: '', accountNumber: '', confirm: '', ifscCode: '', bankName: '', branchName: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF({
      accountHolderName: data.bank?.accountHolderName ?? '',
      accountNumber: '',
      confirm: '',
      ifscCode: data.bank?.ifscCode ?? '',
      bankName: data.bank?.bankName ?? '',
      branchName: data.bank?.branchName ?? '',
    });
  }, [open, data]);

  const set = (key: keyof typeof f, value: string) => setF((prev) => ({ ...prev, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.accountNumber.replace(/\s/g, '') !== f.confirm.replace(/\s/g, '')) return setError('The account numbers do not match');
    try {
      await save.mutateAsync({
        accountHolderName: f.accountHolderName,
        accountNumber: f.accountNumber,
        ifscCode: f.ifscCode,
        bankName: f.bankName,
        branchName: f.branchName || null,
      });
      toast.success('Bank account saved');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the bank account'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={save.isPending}
      icon={<Landmark />}
      title={data.bank ? 'Update bank account' : 'Add bank account'}
      description="Enter the full account number — it is encrypted before it is stored."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="bank-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="bank-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
        <FormError className="sm:col-span-2">{error}</FormError>
        <Field label="Account holder name" htmlFor="bk-holder" required className="sm:col-span-2">
          <Input id="bk-holder" value={f.accountHolderName} onChange={(e) => set('accountHolderName', e.target.value)} required minLength={2} maxLength={100} />
        </Field>
        <Field label="Account number" htmlFor="bk-number" required>
          <Input id="bk-number" value={f.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} required inputMode="numeric" pattern="[0-9 ]{9,22}" className="font-mono" />
        </Field>
        <Field label="Confirm account number" htmlFor="bk-confirm" required>
          <Input id="bk-confirm" value={f.confirm} onChange={(e) => set('confirm', e.target.value)} required inputMode="numeric" className="font-mono" onPaste={(e) => e.preventDefault()} />
        </Field>
        <Field label="IFSC" htmlFor="bk-ifsc" required hint="11 characters, e.g. HDFC0001234">
          <Input id="bk-ifsc" value={f.ifscCode} onChange={(e) => set('ifscCode', e.target.value.toUpperCase())} required maxLength={11} className="font-mono uppercase" />
        </Field>
        <Field label="Bank name" htmlFor="bk-bank" required>
          <Input id="bk-bank" value={f.bankName} onChange={(e) => set('bankName', e.target.value)} required minLength={2} maxLength={100} />
        </Field>
        <Field label="Branch" htmlFor="bk-branch" className="sm:col-span-2">
          <Input id="bk-branch" value={f.branchName} onChange={(e) => set('branchName', e.target.value)} maxLength={100} />
        </Field>
      </form>
    </Modal>
  );
}

// ─── Government IDs dialog ──────────────────────────────────

function IdsDialog({ open, onClose, employeeId, data }: { open: boolean; onClose: () => void; employeeId: string; data: PrivateProfile }) {
  const save = useUpdateStatutory(employeeId);
  const [f, setF] = useState({ pan: '', aadhaar: '', uan: '', pfAccountNo: '', esicNumber: '', taxRegime: 'NEW' as 'OLD' | 'NEW' });
  const [error, setError] = useState<string | null>(null);
  const s = data.statutory;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF({ pan: '', aadhaar: '', uan: s?.uan ?? '', pfAccountNo: s?.pfAccountNo ?? '', esicNumber: s?.esicNumber ?? '', taxRegime: s?.taxRegime ?? 'NEW' });
  }, [open, s]);

  const set = (key: keyof typeof f, value: string) => setF((prev) => ({ ...prev, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        // Blank PAN / Aadhaar = keep what is stored
        ...(f.pan.trim() && { pan: f.pan }),
        ...(f.aadhaar.trim() && { aadhaar: f.aadhaar }),
        uan: f.uan || null,
        pfAccountNo: f.pfAccountNo || null,
        esicNumber: f.esicNumber || null,
        taxRegime: f.taxRegime,
      });
      toast.success('Government IDs saved');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the IDs'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={save.isPending}
      icon={<Fingerprint />}
      title="Government IDs"
      description="Leave PAN or Aadhaar blank to keep the saved value."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="ids-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="ids-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
        <FormError className="sm:col-span-2">{error}</FormError>
        <Field label="PAN" htmlFor="id-pan" hint={s?.panMasked ? `Saved: ${s.panMasked}` : 'e.g. ABCDE1234F'}>
          <Input id="id-pan" value={f.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} maxLength={10} className="font-mono uppercase" />
        </Field>
        <Field label="Aadhaar" htmlFor="id-aadhaar" hint={s?.aadhaarMasked ? `Saved: ${s.aadhaarMasked}` : 'Only the last 4 digits are stored'}>
          <Input id="id-aadhaar" value={f.aadhaar} onChange={(e) => set('aadhaar', e.target.value)} maxLength={14} inputMode="numeric" className="font-mono" />
        </Field>
        <Field label="UAN (PF)" htmlFor="id-uan" hint="12 digits">
          <Input id="id-uan" value={f.uan} onChange={(e) => set('uan', e.target.value)} maxLength={12} inputMode="numeric" className="font-mono" />
        </Field>
        <Field label="PF account number" htmlFor="id-pf">
          <Input id="id-pf" value={f.pfAccountNo} onChange={(e) => set('pfAccountNo', e.target.value.toUpperCase())} maxLength={30} className="font-mono uppercase" />
        </Field>
        <Field label="ESIC number" htmlFor="id-esic" hint="10 or 17 digits">
          <Input id="id-esic" value={f.esicNumber} onChange={(e) => set('esicNumber', e.target.value)} maxLength={17} inputMode="numeric" className="font-mono" />
        </Field>
        <Field label="Tax regime" htmlFor="id-regime">
          <Select id="id-regime" className={inputClass} value={f.taxRegime} onChange={(e) => set('taxRegime', e.target.value)}>
            <option value="NEW">New regime</option>
            <option value="OLD">Old regime</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, ShieldCheck, Tags } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useAccess } from '@/lib/access/use-access';
import { useAssetTypes, useSaveAssetType, type AssetType } from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

export default function AssetTypesPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('ops.assets') && can('asset.manage');
  const types = useAssetTypes(true, allowed);
  const [editing, setEditing] = useState<AssetType | 'new' | null>(null);
  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Assets" title="Asset types" description="Kinds of equipment you track. The prefix starts each asset tag, e.g. LAP-0001." action={<Button onClick={() => setEditing('new')}><Plus /> Add type</Button>} />
      <Card className="overflow-hidden">
        {types.isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <ul className="divide-y divide-border">
            {types.data?.map((t) => (
              <li key={t.id} className={cn('flex items-center gap-3 px-5 py-3', !t.isActive && 'opacity-55')}>
                <span className="w-14 shrink-0 rounded bg-muted px-1.5 py-0.5 text-center font-mono text-xs">{t.prefix}</span>
                <p className="min-w-0 flex-1 font-medium">{t.name}</p>
                {!t.isActive && <Badge>Inactive</Badge>}
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <TypeDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function TypeDialog({ value, onClose }: { value: AssetType | 'new' | null; onClose: () => void }) {
  const save = useSaveAssetType();
  const [f, setF] = useState({ name: '', prefix: '', isActive: true });
  useEffect(() => {
    if (!value) return;
    setF(value === 'new' ? { name: '', prefix: '', isActive: true } : { name: value.name, prefix: value.prefix, isActive: value.isActive });
  }, [value]);
  if (!value) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({ ...(value !== 'new' && { id: value.id }), ...f });
      toast.success('Type saved');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={save.isPending} icon={<Tags />} title={value === 'new' ? 'Add asset type' : `Edit ${value.name}`} className="sm:max-w-md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="type-form" loading={save.isPending}>Save</Button></>}>
      <form id="type-form" onSubmit={submit} className="space-y-3">
        <Field label="Name" htmlFor="ty-name" required><Input id="ty-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={40} /></Field>
        <Field label="Tag prefix" htmlFor="ty-prefix" required hint="2–6 letters or digits. Existing tags don’t change.">
          <Input id="ty-prefix" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value.toUpperCase() })} required pattern="[A-Z0-9]{2,6}" maxLength={6} className="font-mono" />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active (can be requested and added)</label>
      </form>
    </Modal>
  );
}

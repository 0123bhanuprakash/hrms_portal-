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
import { money, useExpenseCategories, useSaveCategory, type ExpenseCategory } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const rule = (c: ExpenseCategory) =>
  [
    c.maxPerItemPaise !== null ? `max ${money(c.maxPerItemPaise)} per item` : 'no limit',
    c.receiptRequiredAbovePaise === null ? 'receipt optional' : c.receiptRequiredAbovePaise === 0 ? 'receipt always' : `receipt above ${money(c.receiptRequiredAbovePaise)}`,
  ].join(' · ');

export default function ExpenseCategoriesPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('ops.expenses') && can('expense.manage');
  const cats = useExpenseCategories(true, allowed);
  const [editing, setEditing] = useState<ExpenseCategory | 'new' | null>(null);
  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Expenses" title="Expense categories" description="What people can claim, the limit per item and when a receipt is needed." action={<Button onClick={() => setEditing('new')}><Plus /> Add category</Button>} />
      <Card className="overflow-hidden">
        {cats.isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <ul className="divide-y divide-border">
            {cats.data?.map((c) => (
              <li key={c.id} className={cn('flex items-center gap-3 px-5 py-3', !c.isActive && 'opacity-55')}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{rule(c)}{c.description && ` · ${c.description}`}</p>
                </div>
                {!c.isActive && <Badge>Inactive</Badge>}
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <CategoryDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CategoryDialog({ value, onClose }: { value: ExpenseCategory | 'new' | null; onClose: () => void }) {
  const save = useSaveCategory();
  const [f, setF] = useState({ name: '', description: '', max: '', receiptMode: 'above' as 'always' | 'above' | 'never', receiptAbove: '', isActive: true });
  useEffect(() => {
    if (!value) return;
    if (value === 'new') return setF({ name: '', description: '', max: '', receiptMode: 'always', receiptAbove: '', isActive: true });
    setF({
      name: value.name,
      description: value.description ?? '',
      max: value.maxPerItemPaise !== null ? String(value.maxPerItemPaise / 100) : '',
      receiptMode: value.receiptRequiredAbovePaise === null ? 'never' : value.receiptRequiredAbovePaise === 0 ? 'always' : 'above',
      receiptAbove: value.receiptRequiredAbovePaise ? String(value.receiptRequiredAbovePaise / 100) : '',
      isActive: value.isActive,
    });
  }, [value]);
  if (!value) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        ...(value !== 'new' && { id: value.id }),
        name: f.name,
        description: f.description || null,
        maxPerItem: f.max ? Number(f.max) : null,
        receiptRequiredAbove: f.receiptMode === 'never' ? null : f.receiptMode === 'always' ? 0 : Number(f.receiptAbove || 0),
        isActive: f.isActive,
      });
      toast.success('Category saved');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={save.isPending} icon={<Tags />} title={value === 'new' ? 'Add category' : `Edit ${value.name}`} className="sm:max-w-md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="cat-form" loading={save.isPending}>Save</Button></>}>
      <form id="cat-form" onSubmit={submit} className="space-y-3">
        <Field label="Name" htmlFor="cat-name" required><Input id="cat-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={60} /></Field>
        <Field label="Description" htmlFor="cat-desc"><Input id="cat-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={200} /></Field>
        <Field label="Max per item (₹)" htmlFor="cat-max" hint="Blank = no limit"><Input id="cat-max" type="number" min={1} step="0.01" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></Field>
        <Field label="Receipt">
          <div className="space-y-2 text-sm">
            {(['always', 'above', 'never'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input type="radio" name="receipt" className="accent-[hsl(var(--primary))]" checked={f.receiptMode === m} onChange={() => setF({ ...f, receiptMode: m })} />
                {m === 'always' ? 'Always required' : m === 'never' ? 'Optional' : 'Required above'}
                {m === 'above' && f.receiptMode === 'above' && <Input type="number" min={0} step="0.01" value={f.receiptAbove} onChange={(e) => setF({ ...f, receiptAbove: e.target.value })} className="ml-1 h-8 w-28" aria-label="Receipt required above (₹)" />}
              </label>
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active</label>
      </form>
    </Modal>
  );
}

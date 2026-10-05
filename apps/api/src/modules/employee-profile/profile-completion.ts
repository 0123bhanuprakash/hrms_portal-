import type { Prisma } from '@prisma/client';

// ============================================================
// Profile completeness — the same checklist for My profile, the
// employee page and the HR list ("profile 72%").
// ============================================================

export const COMPLETION_SELECT = {
  avatarUrl: true,
  phone: true,
  dateOfBirth: true,
  personal: { select: { currentAddress: true, emergencyContactName: true, emergencyContactPhone: true } },
  bankDetails: { select: { id: true } },
  statutoryInfo: { select: { pan: true } },
} satisfies Prisma.EmployeeSelect;

export type CompletionRow = Prisma.EmployeeGetPayload<{ select: typeof COMPLETION_SELECT }>;

export interface Completion {
  percent: number;
  items: Array<{ key: string; label: string; done: boolean }>;
}

export function completionOf(e: CompletionRow): Completion {
  const address = e.personal?.currentAddress as { line1?: string; city?: string } | null | undefined;
  const items = [
    { key: 'photo', label: 'Profile photo', done: Boolean(e.avatarUrl) },
    { key: 'phone', label: 'Phone number', done: Boolean(e.phone) },
    { key: 'dateOfBirth', label: 'Date of birth', done: Boolean(e.dateOfBirth) },
    { key: 'address', label: 'Current address', done: Boolean(address?.line1 && address?.city) },
    { key: 'emergency', label: 'Emergency contact', done: Boolean(e.personal?.emergencyContactName && e.personal?.emergencyContactPhone) },
    { key: 'bank', label: 'Bank account', done: Boolean(e.bankDetails) },
    { key: 'pan', label: 'PAN', done: Boolean(e.statutoryInfo?.pan) },
  ];
  return { percent: Math.round((items.filter((i) => i.done).length / items.length) * 100), items };
}

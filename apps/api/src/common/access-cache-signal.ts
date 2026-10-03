// ============================================================
// "Something that decides access just changed" — raised by PrismaService
// after any write to the tables a signed-in user's access is built from,
// heard by AccessService, which drops its short-lived user cache.
// (A plain module-level signal: PrismaService can't depend on AccessService.)
// ============================================================

/** Models whose rows feed JwtStrategy / AccessService.resolve(). */
export const ACCESS_MODELS = new Set(['User', 'UserRole', 'Role', 'RolePermission', 'Company', 'Employee', 'ApprovalDelegation']);

const listeners = new Set<() => void>();

export function onAccessDataChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function accessDataChanged(): void {
  for (const fn of listeners) fn();
}

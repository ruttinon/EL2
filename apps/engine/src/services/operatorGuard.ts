/** Operator role guard for tag writes (Phase 14) */

export type OperatorRole = 'viewer' | 'operator' | 'engineer';

export function resolveOperatorRole(header: unknown): OperatorRole {
  const raw = typeof header === 'string' ? header.trim().toLowerCase() : '';
  if (raw === 'operator' || raw === 'engineer') return raw;
  if (raw === 'viewer') return 'viewer';
  return 'operator';
}

export function canWriteTags(role: OperatorRole): boolean {
  return role === 'operator' || role === 'engineer';
}

export function isWriteGuardEnabled(): boolean {
  const v = process.env.ENERGYLINK_WRITE_GUARD;
  return v === '1' || v === 'true';
}

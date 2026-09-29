/**
 * Organization-scope helpers. Every tenant-owned resource must resolve through
 * one of these so org boundaries are enforced by construction (docs/02 §3.5).
 *
 * Usage:
 *   const campaign = await mustBelongToOrg(row, orgId, "Campaign");
 */

export class OrgScopeViolation extends Error {
  constructor(resource: string, resourceId: string, orgId: string) {
    super(
      `${resource} ${resourceId} does not belong to organization ${orgId} (cross-tenant access attempt).`,
    );
    this.name = "OrgScopeViolation";
  }
}

/** Narrow an entity with `organizationId` to the given org or fail. */
export function mustBelongToOrg<T extends { id: string; organizationId: string }>(
  entity: T | null | undefined,
  orgId: string,
  label = "Resource",
): T {
  if (!entity || entity.organizationId !== orgId) {
    // Same opaque message for "missing" and "wrong org" — do not leak existence.
    throw new OrgScopeViolation(label, entity?.id ?? "unknown", orgId);
  }
  return entity;
}

/** Which fields a role may write per resource family (docs/03 §1 RBAC). */
export const ROLE_RANK = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 } as const;
export type RoleName = keyof typeof ROLE_RANK;

export function roleAtLeast(role: RoleName, min: RoleName): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

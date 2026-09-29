import { prisma } from "../client";
import { mustBelongToOrg } from "@omnipost/shared";
import type { Role } from "../generated/prisma/enums";

export interface BootstrapOrgInput {
  name: string;
  slug: string;
  ownerUserId: string;
}

/**
 * Creates the default organization, Owner membership, default Brand and
 * settings row atomically (spec §5 Module A: registration → working org).
 * Unlimited plan semantics are code-level for now (no gating exists).
 */
export async function bootstrapOrganizationWithOwner(input: BootstrapOrgInput) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
      },
    });

    await tx.membership.create({
      data: {
        organizationId: org.id,
        userId: input.ownerUserId,
        role: "OWNER",
        isDefaultOrg: true,
      },
    });

    await tx.brand.create({
      data: {
        organizationId: org.id,
        name: "SoloNomous Labs",
        voice: "Technical, friendly, confident, human",
        avoid: "Corporate language; fake urgency; overpromising",
        audience: "Developers; small businesses; startups",
        isDefault: true,
      },
    });

    await tx.organizationSettings.create({
      data: { organizationId: org.id },
    });

    return org;
  });
}

export async function getOrganizationById(organizationId: string) {
  // Organization IS the tenant boundary — no org-scope assertion applies to it.
  return prisma.organization.findUnique({ where: { id: organizationId } });
}

export async function getOrganizationBySlug(slug: string) {
  return prisma.organization.findUnique({ where: { slug } });
}

export async function listMembershipsForUser(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getMembership(organizationId: string, userId: string) {
  return prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

export async function assertMembershipRole(
  organizationId: string,
  userId: string,
  min: Role,
): Promise<{ membership: { id: string; role: Role }; organizationId: string }> {
  const membership = await getMembership(organizationId, userId);
  if (!membership) {
    throw Object.assign(new Error("Not a member of this organization"), { code: "FORBIDDEN" });
  }
  const rank: Record<Role, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 };
  if (rank[membership.role as Role] < rank[min]) {
    throw Object.assign(new Error(`Requires ${min} role`), { code: "FORBIDDEN" });
  }
  return { membership, organizationId };
}

// Re-export for consumers that scope tenant rows (kept from earlier revisions).
export { mustBelongToOrg };

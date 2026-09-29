import { prisma } from "../client";

export interface CreateUserInput {
  email: string;
  name?: string | null;
  passwordHash?: string | null;
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(input: CreateUserInput) {
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      passwordHash: input.passwordHash ?? null,
    },
  });
}

/**
 * Register = user + default organization + Owner membership + brand + settings,
 * all atomic. This is the Phase 1 path; SaaS-style join-org flows come later.
 */
export async function registerUserWithOrganization(args: {
  email: string;
  name?: string | null;
  passwordHash: string;
  organizationName: string;
  organizationSlug: string;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: args.email.toLowerCase(),
        name: args.name ?? null,
        passwordHash: args.passwordHash,
      },
    });

    const org = await tx.organization.create({
      data: { name: args.organizationName, slug: args.organizationSlug },
    });

    await tx.membership.create({
      data: {
        organizationId: org.id,
        userId: user.id,
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

    await tx.organizationSettings.create({ data: { organizationId: org.id } });

    return { user, organization: org };
  });
}

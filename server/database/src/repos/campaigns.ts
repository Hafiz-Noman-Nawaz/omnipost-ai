import { prisma } from "../client";
import { conflict, notFound, validationError } from "@omnipost/shared";
import { isPlatformKey } from "@omnipost/shared";
import type { CampaignStatus } from "../generated/prisma/enums";

/**
 * Campaign System repository (docs/02 §2 Campaign, docs/03 Campaigns).
 * Every read/write is organization-scoped; ids from other orgs resolve to
 * NOT_FOUND (no existence leak).
 */

export interface CreateCampaignInput {
  organizationId: string;
  brandId?: string | null;
  name: string;
  description?: string | null;
  objective?: string | null;
  targetAudience?: string | null;
  tone?: string | null;
  brandVoice?: string | null;
  cta?: string | null;
  landingUrl?: string | null;
  platforms?: string[];
  timezone?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: CampaignStatus;
  approvalRequired?: boolean;
  postingFrequency?: unknown;
  affiliateNetwork?: string | null;
  affiliateUrl?: string | null;
  disclosureText?: string | null;
}

/** postingFrequency must look like { perDay: number, windows?: string[] }. */
function validatePostingFrequency(freq: unknown) {
  if (freq === undefined || freq === null) return;
  if (typeof freq !== "object" || Array.isArray(freq)) {
    throw validationError("`postingFrequency` must be an object.");
  }
  const f = freq as Record<string, unknown>;
  if (f.perDay !== undefined && (typeof f.perDay !== "number" || f.perDay < 1 || f.perDay > 50)) {
    throw validationError("`postingFrequency.perDay` must be a number between 1 and 50.");
  }
  if (f.windows !== undefined) {
    if (!Array.isArray(f.windows) || f.windows.some((w) => typeof w !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(w))) {
      throw validationError("`postingFrequency.windows` must be HH:MM strings (e.g. \"09:00\").");
    }
  }
}

async function assertBrandInOrg(organizationId: string, brandId: string | null | undefined) {
  if (!brandId) return;
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand || brand.organizationId !== organizationId) {
    throw notFound("Brand");
  }
}

/** Timezone strings are IANA names; a wrong one fails at generation time, so check early. */
function assertValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw validationError(`\`timezone\` is not a valid IANA timezone: ${tz}`);
  }
}

function validateDates(startDate?: Date | null, endDate?: Date | null) {
  if (startDate && endDate && startDate > endDate) {
    throw validationError("`startDate` must be before `endDate`.");
  }
}

export async function createCampaign(input: CreateCampaignInput) {
  await assertBrandInOrg(input.organizationId, input.brandId);
  const tz = input.timezone ?? "UTC";
  assertValidTimezone(tz);
  validateDates(input.startDate ?? null, input.endDate ?? null);
  validatePostingFrequency(input.postingFrequency);
  for (const p of input.platforms ?? []) {
    if (!isPlatformKey(p)) {
      throw validationError(`Unknown platform "${p}".`);
    }
  }

  return prisma.campaign.create({
    data: {
      organizationId: input.organizationId,
      brandId: input.brandId ?? null,
      name: input.name,
      description: input.description ?? null,
      objective: input.objective ?? null,
      targetAudience: input.targetAudience ?? null,
      tone: input.tone ?? null,
      brandVoice: input.brandVoice ?? null,
      cta: input.cta ?? null,
      landingUrl: input.landingUrl ?? null,
      platforms: input.platforms ?? [],
      timezone: tz,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status ?? "DRAFT",
      approvalRequired: input.approvalRequired ?? true,
      postingFrequency: (input.postingFrequency ?? undefined) as never,
      affiliateNetwork: input.affiliateNetwork ?? null,
      affiliateUrl: input.affiliateUrl ?? null,
      disclosureText: input.disclosureText ?? null,
    },
  });
}

export interface CampaignFilter {
  status?: CampaignStatus;
  platform?: string;
  brandId?: string;
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "name" | "startDate";
  order?: "asc" | "desc";
}

export async function listCampaigns(organizationId: string, filter: CampaignFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
  const sort = filter.sort ?? "createdAt";
  const order = filter.order ?? "desc";

  const where = {
    organizationId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.brandId ? { brandId: filter.brandId } : {}),
    ...(filter.platform ? { platforms: { has: filter.platform } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { brand: { select: { id: true, name: true, isDefault: true } } },
    }),
    prisma.campaign.count({ where }),
  ]);

  return { data: items, meta: { page, pageSize, total } };
}

export async function getCampaignById(organizationId: string, id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true, isDefault: true } },
      _count: { select: { content: true } },
    },
  });
  // Another org's id is indistinguishable from a missing one (no existence leak).
  if (!campaign || campaign.organizationId !== organizationId) return null;
  return campaign;
}

export interface UpdateCampaignInput {
  brandId?: string | null;
  name?: string;
  description?: string | null;
  objective?: string | null;
  targetAudience?: string | null;
  tone?: string | null;
  brandVoice?: string | null;
  cta?: string | null;
  landingUrl?: string | null;
  platforms?: string[];
  timezone?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: CampaignStatus;
  approvalRequired?: boolean;
  postingFrequency?: unknown;
  affiliateNetwork?: string | null;
  affiliateUrl?: string | null;
  disclosureText?: string | null;
}

/**
 * Campaign lifecycle (docs/02 §1): DRAFT → ACTIVE ⇄ PAUSED → COMPLETED/ARCHIVED.
 * Most editing happens via PATCH on any status; direct status edits are guarded.
 */
const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "COMPLETED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

/**
 * Dedicated pause/resume helpers use the same guard as PATCH status edits —
 * but resume specifically means "back to ACTIVE from PAUSED"; a DRAFT was never
 * running, so resuming it is a conflict (docs/03: resume only after pause).
 */
export function assertCampaignTransition(from: CampaignStatus, to: CampaignStatus) {
  const allowed = CAMPAIGN_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw conflict(
      `Cannot move campaign from ${from} to ${to}. Allowed: ${allowed && allowed.length ? allowed.join(", ") : "none"}.`,
    );
  }
}

export async function updateCampaign(
  organizationId: string,
  id: string,
  input: UpdateCampaignInput,
) {
  const existing = await getCampaignById(organizationId, id);
  if (!existing) throw notFound("Campaign");

  if (input.status && input.status !== existing.status) {
    assertCampaignTransition(existing.status, input.status);
  }

  await assertBrandInOrg(organizationId, input.brandId);

  const tz = input.timezone;
  if (tz !== undefined) assertValidTimezone(tz);
  validateDates(
    input.startDate !== undefined ? input.startDate : existing.startDate,
    input.endDate !== undefined ? input.endDate : existing.endDate,
  );
  if (input.platforms) {
    for (const p of input.platforms) {
      if (!isPlatformKey(p)) throw validationError(`Unknown platform "${p}".`);
    }
  }
  if (input.postingFrequency !== undefined) {
    validatePostingFrequency(input.postingFrequency);
  }

  return prisma.campaign.update({
    where: { id },
    data: {
      ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.objective !== undefined ? { objective: input.objective } : {}),
      ...(input.targetAudience !== undefined ? { targetAudience: input.targetAudience } : {}),
      ...(input.tone !== undefined ? { tone: input.tone } : {}),
      ...(input.brandVoice !== undefined ? { brandVoice: input.brandVoice } : {}),
      ...(input.cta !== undefined ? { cta: input.cta } : {}),
      ...(input.landingUrl !== undefined ? { landingUrl: input.landingUrl } : {}),
      ...(input.platforms !== undefined ? { platforms: input.platforms } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.approvalRequired !== undefined ? { approvalRequired: input.approvalRequired } : {}),
      ...(input.postingFrequency !== undefined
        ? { postingFrequency: input.postingFrequency as never }
        : {}),
      ...(input.affiliateNetwork !== undefined ? { affiliateNetwork: input.affiliateNetwork } : {}),
      ...(input.affiliateUrl !== undefined ? { affiliateUrl: input.affiliateUrl } : {}),
      ...(input.disclosureText !== undefined ? { disclosureText: input.disclosureText } : {}),
    },
  });
}

/**
 * Pause (docs/03): ADMIN-only; only ACTIVE campaigns can pause. Worker skips
 * queue jobs of PAUSED campaigns once Phase 6 lands.
 */
export async function pauseCampaign(organizationId: string, id: string) {
  const existing = await getCampaignById(organizationId, id);
  if (!existing) throw notFound("Campaign");
  assertCampaignTransition(existing.status, "PAUSED");
  return prisma.campaign.update({
    where: { id },
    data: { status: "PAUSED", pausedAt: new Date() },
  });
}

export async function resumeCampaign(organizationId: string, id: string) {
  const existing = await getCampaignById(organizationId, id);
  if (!existing) throw notFound("Campaign");
  if (existing.status !== "PAUSED") {
    throw conflict(`Only PAUSED campaigns can be resumed (this one is ${existing.status}).`);
  }
  return prisma.campaign.update({
    where: { id },
    data: { status: "ACTIVE", pausedAt: null },
  });
}

/**
 * Archive semantics (docs/03): never hard-delete a campaign that still has
 * associated content — archive it so history stays intact.
 */
export async function deleteCampaign(
  organizationId: string,
  id: string,
): Promise<"deleted" | "archived"> {
  const existing = await getCampaignById(organizationId, id);
  if (!existing) throw notFound("Campaign");

  const contentCount = await prisma.content.count({
    where: { campaignId: id, organizationId },
  });

  if (existing.status !== "ARCHIVED") assertCampaignTransition(existing.status, "ARCHIVED");

  if (contentCount > 0) {
    await prisma.campaign.update({ where: { id }, data: { status: "ARCHIVED" } });
    return "archived";
  }
  await prisma.campaign.delete({ where: { id } });
  return "deleted";
}

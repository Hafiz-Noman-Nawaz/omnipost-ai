import { prisma } from "../client";
import { notFound, validationError } from "@omnipost/shared";

/**
 * Brand profile repository (docs/02 §2 Brand, docs/03 "Brand & memory").
 * Voice/avoid/audience/guidelines feed agent generation (Phase 4) and are
 * inherited by campaigns unless overridden per-campaign (brandVoice).
 */

export interface BrandInput {
  name: string;
  voice?: string | null;
  avoid?: string | null;
  audience?: string | null;
  guidelines?: unknown;
  isDefault?: boolean;
}

/**
 * At most one default brand per org: making a brand default clears the flag on
 * every other row in the same org. Only called when a brand IS (or just became)
 * the default — never as a side effect of unrelated writes.
 */
async function enforceSingleDefault(organizationId: string, brandId: string) {
  await prisma.brand.updateMany({
    where: { organizationId, isDefault: true, id: { not: brandId } },
    data: { isDefault: false },
  });
}

export async function createBrand(organizationId: string, input: BrandInput) {
  if (!input.name.trim()) throw validationError("Brand name is required.");
  const brand = await prisma.brand.create({
    data: {
      organizationId,
      name: input.name,
      voice: input.voice ?? null,
      avoid: input.avoid ?? null,
      audience: input.audience ?? null,
      guidelines: (input.guidelines ?? undefined) as never,
      isDefault: input.isDefault ?? false,
    },
  });
  if (brand.isDefault) await enforceSingleDefault(organizationId, brand.id);
  return brand;
}

export async function getBrandById(organizationId: string, id: string) {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: { _count: { select: { campaigns: true } } },
  });
  // Another org's id is indistinguishable from a missing one (no existence leak).
  if (!brand || brand.organizationId !== organizationId) return null;
  return brand;
}

export async function listBrands(organizationId: string) {
  return prisma.brand.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { _count: { select: { campaigns: true } } },
  });
}

export async function getDefaultBrand(organizationId: string) {
  return prisma.brand.findFirst({
    where: { organizationId, isDefault: true },
  });
}

export interface UpdateBrandInput {
  name?: string;
  voice?: string | null;
  avoid?: string | null;
  audience?: string | null;
  guidelines?: unknown;
  isDefault?: boolean;
}

export async function updateBrand(organizationId: string, id: string, input: UpdateBrandInput) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) throw notFound("Brand");
  if (input.name !== undefined && !input.name.trim()) {
    throw validationError("Brand name is required.");
  }

  const brand = await prisma.brand.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.voice !== undefined ? { voice: input.voice } : {}),
      ...(input.avoid !== undefined ? { avoid: input.avoid } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      ...(input.guidelines !== undefined ? { guidelines: input.guidelines as never } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  });
  if (brand.isDefault) await enforceSingleDefault(organizationId, brand.id);
  return brand;
}

/**
 * A brand in use by campaigns is archived-by-constraint, not deleted: the
 * default-brand FK would orphan campaigns. We clear defaults carefully and
 * refuse deletion while campaigns still reference the brand.
 */
export async function deleteBrand(organizationId: string, id: string): Promise<"deleted" | "in-use"> {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) throw notFound("Brand");

  const campaignCount = await prisma.campaign.count({
    where: { brandId: id, organizationId },
  });
  if (campaignCount > 0) return "in-use";

  await prisma.brand.delete({ where: { id } });
  return "deleted";
}

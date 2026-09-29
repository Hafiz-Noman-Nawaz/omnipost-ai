import { z } from "zod";
import { deleteCampaign, getCampaignById, updateCampaign, writeAudit } from "@omnipost/database";
import type { CampaignStatus } from "@omnipost/database";
import { PLATFORM_KEYS } from "@omnipost/shared";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";
import { notFound } from "@omnipost/shared";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const campaign = await getCampaignById(ctx.organizationId, id);
    if (!campaign) throw notFound("Campaign");
    return ok(campaign);
  } catch (err) {
    return fail(err);
  }
}

const postingFrequencySchema = z
  .object({
    perDay: z.number().int().min(1).max(50).optional(),
    windows: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "windows must be HH:MM")).max(12).optional(),
  })
  .refine((v) => v.perDay !== undefined || v.windows !== undefined, {
    message: "postingFrequency needs perDay and/or windows",
  });

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  brandId: z.string().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  objective: z.string().max(500).nullable().optional(),
  targetAudience: z.string().max(2000).nullable().optional(),
  tone: z.string().max(500).nullable().optional(),
  brandVoice: z.string().max(2000).nullable().optional(),
  cta: z.string().max(200).nullable().optional(),
  landingUrl: z.string().url().max(2000).nullable().optional(),
  platforms: z.array(z.enum(PLATFORM_KEYS)).max(PLATFORM_KEYS.length).optional(),
  timezone: z.string().max(64).optional(),
  startDate: z.coerce.date().refine((d) => !Number.isNaN(d.getTime())).nullable().optional(),
  endDate: z.coerce.date().refine((d) => !Number.isNaN(d.getTime())).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  approvalRequired: z.boolean().optional(),
  postingFrequency: postingFrequencySchema.nullable().optional(),
  affiliateNetwork: z.string().max(120).nullable().optional(),
  affiliateUrl: z.string().url().max(2000).nullable().optional(),
  disclosureText: z.string().max(300).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await parseBody(req, patchSchema);

    const campaign = await updateCampaign(ctx.organizationId, id, body);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "campaign.updated",
      resourceType: "campaign",
      resourceId: id,
      metadata: { ...body },
    });

    return ok(campaign);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const { id } = await params;

    const result = await deleteCampaign(ctx.organizationId, id);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: result === "deleted" ? "campaign.deleted" : "campaign.archived",
      resourceType: "campaign",
      resourceId: id,
    });

    return ok({ result });
  } catch (err) {
    return fail(err);
  }
}

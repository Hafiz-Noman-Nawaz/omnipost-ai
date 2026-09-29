import { z } from "zod";
import { createCampaign, listCampaigns, writeAudit } from "@omnipost/database";
import type { CampaignStatus } from "@omnipost/database";
import { PLATFORM_KEYS, validationError } from "@omnipost/shared";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

const STATUSES: CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const p = new URL(req.url).searchParams;

    const status = p.get("status");
    const result = await listCampaigns(ctx.organizationId, {
      status:
        status && STATUSES.includes(status as CampaignStatus)
          ? (status as CampaignStatus)
          : undefined,
      platform: p.get("platform") ?? undefined,
      brandId: p.get("brandId") ?? undefined,
      page: Number(p.get("page") ?? "1") || 1,
      pageSize: Number(p.get("pageSize") ?? "25") || 25,
      sort: (p.get("sort") as "createdAt" | "name" | "startDate" | null) ?? "createdAt",
      order: p.get("order") === "asc" ? "asc" : "desc",
    });

    return ok(result.data, result.meta);
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

const createSchema = z.object({
  name: z.string().min(1).max(200),
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
  status: z.enum(["DRAFT", "ACTIVE"]).optional(), // create never starts archived/completed/paused
  approvalRequired: z.boolean().optional(),
  postingFrequency: postingFrequencySchema.nullable().optional(),
  affiliateNetwork: z.string().max(120).nullable().optional(),
  affiliateUrl: z.string().url().max(2000).nullable().optional(),
  disclosureText: z.string().max(300).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await parseBody(req, createSchema);

    if (body.endDate && body.startDate && body.startDate > body.endDate) {
      throw validationError("`startDate` must be before `endDate`.");
    }

    const campaign = await createCampaign({
      organizationId: ctx.organizationId,
      ...body,
      postingFrequency: body.postingFrequency ?? null,
    });

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "campaign.created",
      resourceType: "campaign",
      resourceId: campaign.id,
      metadata: { name: campaign.name, platforms: campaign.platforms },
    });

    return ok(campaign, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}

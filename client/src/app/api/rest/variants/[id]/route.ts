import { z } from "zod";
import { setVariantApproval, updateVariant, writeAudit } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  approved: z.boolean().optional(),
  caption: z.string().min(1).optional(),
  hook: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  hashtags: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await parseBody(req, patchSchema);

    const variant = await updateVariant(ctx.organizationId, id, body);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: body.approved === true ? "variant.approved" : body.approved === false ? "variant.rejected" : "variant.edited",
      resourceType: "content_variant",
      resourceId: id,
      metadata: { platform: variant.platform, contentId: variant.contentId },
    });

    return ok(variant);
  } catch (err) {
    return fail(err);
  }
}

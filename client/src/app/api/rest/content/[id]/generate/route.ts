import { z } from "zod";
import { generateVariants, writeAudit } from "@omnipost/database";
import { PLATFORM_KEYS } from "@omnipost/shared";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  platforms: z.array(z.enum(PLATFORM_KEYS)).min(1).max(PLATFORM_KEYS.length),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await parseBody(req, bodySchema);

    const result = await generateVariants({
      organizationId: ctx.organizationId,
      contentId: id,
      platforms: body.platforms,
    });

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "content.variants_generated",
      resourceType: "content",
      resourceId: id,
      metadata: {
        platforms: body.platforms,
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        results: result.results.map((r) => ({ platform: r.platform, status: r.status })),
      },
    });

    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

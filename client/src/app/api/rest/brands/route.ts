import { z } from "zod";
import { createBrand, listBrands, writeAudit } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireApiRole("VIEWER");
    const brands = await listBrands(ctx.organizationId);
    return ok(brands);
  } catch (err) {
    return fail(err);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  voice: z.string().max(2000).nullable().optional(),
  avoid: z.string().max(2000).nullable().optional(),
  audience: z.string().max(2000).nullable().optional(),
  guidelines: z.unknown().optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await parseBody(req, createSchema);

    const brand = await createBrand(ctx.organizationId, body);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "brand.created",
      resourceType: "brand",
      resourceId: brand.id,
      metadata: { name: brand.name, isDefault: brand.isDefault },
    });

    return ok(brand, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}

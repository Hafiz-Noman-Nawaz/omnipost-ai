import { z } from "zod";
import { deleteBrand, getBrandById, updateBrand, writeAudit } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";
import { conflict, notFound } from "@omnipost/shared";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const brand = await getBrandById(ctx.organizationId, id);
    if (!brand) throw notFound("Brand");
    return ok(brand);
  } catch (err) {
    return fail(err);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  voice: z.string().max(2000).nullable().optional(),
  avoid: z.string().max(2000).nullable().optional(),
  audience: z.string().max(2000).nullable().optional(),
  guidelines: z.unknown().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await parseBody(req, patchSchema);

    const brand = await updateBrand(ctx.organizationId, id, body);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "brand.updated",
      resourceType: "brand",
      resourceId: id,
      metadata: { ...body },
    });

    return ok(brand);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;

    const result = await deleteBrand(ctx.organizationId, id);
    if (result === "in-use") {
      throw conflict(
        "This brand is still referenced by campaigns. Remove or reassign those campaigns first.",
      );
    }

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "brand.deleted",
      resourceType: "brand",
      resourceId: id,
      metadata: { name: undefined },
    });

    return ok({ result });
  } catch (err) {
    return fail(err);
  }
}

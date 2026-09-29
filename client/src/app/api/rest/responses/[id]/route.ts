import {
  getResponseTemplateById,
  updateResponseTemplate,
  deleteResponseTemplate,
} from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const template = await getResponseTemplateById(ctx, id);
    return ok(template);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await req.json();

    const updated = await updateResponseTemplate(ctx, id, {
      name: body.name,
      intent: body.intent,
      body: body.body,
      platforms: body.platforms,
      active: body.active,
    });

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const result = await deleteResponseTemplate(ctx, id);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

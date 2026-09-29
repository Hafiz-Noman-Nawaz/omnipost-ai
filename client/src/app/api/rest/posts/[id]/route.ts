import { z } from "zod";
import { getPost, updatePost, prisma } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";
import { AppError } from "@omnipost/shared";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchPostSchema = z.object({
  caption: z.string().min(1).optional(),
  hashtags: z.array(z.string()).optional(),
  linkUrl: z.string().nullable().optional(),
  mediaStorageKeys: z.array(z.string()).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const post = await getPost(ctx, id);
    return ok(post);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await parseBody(req, patchPostSchema);

    const post = await updatePost(ctx, id, body);
    return ok(post);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;

    const post = await getPost(ctx, id);
    if (post.status === "PUBLISHED" || post.status === "SCHEDULED") {
      throw new AppError("VALIDATION_ERROR", `Cannot delete post with status ${post.status}.`);
    }

    await prisma.post.delete({
      where: { id },
    });

    return ok({ deleted: true, id });
  } catch (err) {
    return fail(err);
  }
}

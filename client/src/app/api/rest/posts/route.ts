import { z } from "zod";
import { createPost, prisma } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

const createPostSchema = z.object({
  contentId: z.string().min(1),
  campaignId: z.string().optional(),
  platform: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).optional(),
  linkUrl: z.string().nullable().optional(),
  mediaStorageKeys: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const url = new URL(req.url);

    const platform = url.searchParams.get("platform") ?? undefined;
    const campaignId = url.searchParams.get("campaignId") ?? undefined;
    const contentId = url.searchParams.get("contentId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;

    const posts = await prisma.post.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(platform ? { platform } : {}),
        ...(campaignId ? { campaignId } : {}),
        ...(contentId ? { contentId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        content: true,
      },
    });

    return ok(posts);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await parseBody(req, createPostSchema);

    const post = await createPost(ctx, body);
    return ok(post, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}

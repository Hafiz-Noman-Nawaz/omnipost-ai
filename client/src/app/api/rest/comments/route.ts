import {
  listComments,
  upsertComment,
  getCommentsSummary,
} from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || undefined;
    const intent = searchParams.get("intent") || undefined;
    const postId = searchParams.get("postId") || undefined;
    const platform = searchParams.get("platform") || undefined;
    const search = searchParams.get("search") || undefined;
    const requiresHumanParam = searchParams.get("requiresHuman");
    const requiresHuman =
      requiresHumanParam === "true"
        ? true
        : requiresHumanParam === "false"
          ? false
          : undefined;

    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 50;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!, 10)
      : 0;

    const [result, summary] = await Promise.all([
      listComments(ctx, {
        status,
        intent,
        postId,
        platform,
        requiresHuman,
        search,
        limit,
        offset,
      }),
      getCommentsSummary(ctx),
    ]);

    return ok({
      comments: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      summary,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await req.json();
    const {
      postId,
      platform,
      platformCommentId,
      parentPlatformCommentId,
      authorName,
      authorId,
      text,
      postedAt,
    } = body;

    if (!postId || !platform || !text) {
      throw new Error("postId, platform, and text are required");
    }

    const comment = await upsertComment(ctx, {
      postId,
      platform,
      platformCommentId:
        platformCommentId || `manual_c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      parentPlatformCommentId,
      authorName,
      authorId,
      text,
      postedAt: postedAt ? new Date(postedAt) : new Date(),
    });

    return ok(comment, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}

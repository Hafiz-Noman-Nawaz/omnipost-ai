import {
  getCommentById,
  updateCommentClassification,
} from "@omnipost/database";
import { selectLLMProvider, classifyComment } from "@omnipost/ai";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const comment = await getCommentById(ctx, id);

    const { provider: llm } = selectLLMProvider();
    const classification = await classifyComment(llm, {
      platform: comment.platform,
      commentText: comment.text,
      authorName: comment.authorName,
      postCaption: comment.post.caption,
    });

    const updated = await updateCommentClassification(ctx, comment.id, {
      intent: classification.intent as any,
      intentConfidence: classification.confidence,
      sentiment: classification.sentiment,
      safetyFlags: classification.safetyFlags,
    });

    return ok({
      comment: updated,
      classification,
    });
  } catch (err) {
    return fail(err);
  }
}

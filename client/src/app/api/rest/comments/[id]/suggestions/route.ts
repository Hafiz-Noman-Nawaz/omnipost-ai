import { getCommentById, prisma } from "@omnipost/database";
import { selectLLMProvider, generateReplySuggestions } from "@omnipost/ai";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const comment = await getCommentById(ctx, id);

    // Get brand profile if exists
    const brand = await prisma.brand.findFirst({
      where: { organizationId: ctx.organizationId },
    });

    const { provider: llm } = selectLLMProvider();
    const suggestionsResult = await generateReplySuggestions(llm, {
      platform: comment.platform,
      commentText: comment.text,
      intent: comment.intent || "GENERAL",
      sentiment: comment.sentiment || "NEUTRAL",
      brandName: brand?.name || "OmniPost",
      brandVoice: brand?.voice || "friendly, helpful, and professional",
      postCaption: comment.post?.caption,
    });

    // Also fetch relevant saved response templates matching this intent
    const templates = comment.intent
      ? await prisma.responseTemplate.findMany({
          where: {
            organizationId: ctx.organizationId,
            intent: comment.intent,
            active: true,
          },
          take: 5,
        })
      : [];

    return ok({
      commentId: comment.id,
      suggestions: suggestionsResult.suggestions,
      templates,
    });
  } catch (err) {
    return fail(err);
  }
}

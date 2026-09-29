import { replyToSocialComment } from "@omnipost/worker";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const { id } = await params;
    const body = await req.json();
    const { replyText, templateId } = body;

    if (!replyText || !replyText.trim()) {
      throw new Error("replyText is required");
    }

    const updated = await replyToSocialComment(
      ctx,
      id,
      replyText.trim(),
      templateId
    );

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}

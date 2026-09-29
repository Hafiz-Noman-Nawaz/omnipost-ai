import { NextRequest, NextResponse } from "next/server";
import { upsertComment } from "@omnipost/database";

export async function GET(req: NextRequest) {
  // Meta webhook verification handshake
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || "omnipost_webhook_secret";

  if (mode === "subscribe" && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Example inbound comment payload parsing
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];

    if (change?.field === "comments" || change?.value?.item === "comment") {
      const val = change.value;
      const platformCommentId = val.comment_id || val.id || `wh_${Date.now()}`;
      const postId = val.post_id || "unknown";
      const text = val.message || val.text || "";
      const authorName = val.from?.name || "Social User";
      const authorId = val.from?.id || "anon";

      // Best effort ingestion
      try {
        await upsertComment(
          {
            organizationId: "org-default",
            user: { id: "system", name: "System Worker", role: "OWNER" as any, email: "system@omnipost.local" },
          },
          {
            postId,
            platform: "INSTAGRAM",
            platformCommentId,
            text,
            authorName,
            authorId,
            postedAt: new Date(),
          }
        );
      } catch {
        // Ignored if post doesn't exist locally
      }
    }

    return NextResponse.json({ ok: true, received: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

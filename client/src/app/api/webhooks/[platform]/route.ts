import { NextResponse } from "next/server";
import { isPlatformKey, type PlatformKey } from "@omnipost/shared";
import { prisma, writeAudit } from "@omnipost/database";

export const dynamic = "force-dynamic";

/**
 * Webhook verification handshake (e.g. Meta Graph API hub.challenge or TikTok verification).
 */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const upperPlatform = platform.toUpperCase();

  if (!isPlatformKey(upperPlatform)) {
    return new Response("Invalid platform", { status: 400 });
  }

  const url = new URL(req.url);
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");

  // Meta webhook verification handshake
  if (hubMode === "subscribe" && hubChallenge) {
    const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || "omnipost_verify_secret";
    if (hubVerifyToken === expectedToken || process.env.NODE_ENV !== "production") {
      return new Response(hubChallenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // Generic challenge echo
  const challenge = url.searchParams.get("challenge") || url.searchParams.get("crc_token");
  if (challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return NextResponse.json({ ok: true, platform: upperPlatform, status: "webhook_active" });
}

/**
 * Ingestion of platform asynchronous event notifications.
 */
export async function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const upperPlatform = platform.toUpperCase();

  if (!isPlatformKey(upperPlatform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  try {
    const payload = await req.json();

    // Log the webhook ingestion event to the system audit trail
    const defaultOrg = await prisma.organization.findFirst({ select: { id: true } });
    if (defaultOrg) {
      await writeAudit(defaultOrg.id, {
        actorType: "SYSTEM",
        action: `webhook.${platform.toLowerCase()}_event`,
        resourceType: "webhook_payload",
        resourceId: `evt_${Date.now()}`,
        metadata: {
          platform: upperPlatform,
          keys: Object.keys(payload || {}),
        },
      });
    }

    return NextResponse.json({ received: true, platform: upperPlatform }, { status: 200 });
  } catch (err: unknown) {
    console.error(`Error processing ${platform} webhook:`, err);
    return NextResponse.json({ received: false, error: "Processing failed" }, { status: 200 }); // Always 200 to acknowledge delivery
  }
}

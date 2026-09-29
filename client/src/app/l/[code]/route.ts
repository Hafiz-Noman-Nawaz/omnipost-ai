import { NextRequest, NextResponse } from "next/server";
import { resolveShortLink } from "@omnipost/database";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const referrer = req.headers.get("referer");
  const userAgent = req.headers.get("user-agent");

  const link = await resolveShortLink(code, {
    referrer,
    userAgent,
  });

  if (!link) {
    return new NextResponse("Short link not found or expired", { status: 404 });
  }

  // Redirect to full target URL with UTM parameters
  return NextResponse.redirect(link.targetUrl, { status: 302 });
}

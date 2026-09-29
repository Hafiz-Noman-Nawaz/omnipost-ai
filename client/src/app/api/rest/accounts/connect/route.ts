import { isPlatformKey, type PlatformKey } from "@omnipost/shared";
import { fail, ok, requireApiRole } from "@/lib/api";
import { getSocialProvider } from "../../../../../../../server/worker/src/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await req.json();
    const { platform, redirectUri } = body;

    if (!platform || !isPlatformKey(platform)) {
      throw new Error(`Invalid or missing platform: ${platform}`);
    }

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const callbackUri = redirectUri || `${appUrl}/accounts?oauth_callback=true&platform=${platform}`;

    const provider = getSocialProvider(platform as PlatformKey);
    const result = await provider.connect({
      organizationId: ctx.organizationId,
      redirectUri: callbackUri,
      state: `${platform.toLowerCase()}_state_${Date.now()}`,
    });

    return ok({
      platform,
      authorizationUrl: result.authorizationUrl,
      state: result.state,
    });
  } catch (err) {
    return fail(err);
  }
}

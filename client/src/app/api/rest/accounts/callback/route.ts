import { connectSocialAccount } from "@omnipost/database";
import { isPlatformKey, type PlatformKey } from "@omnipost/shared";
import { fail, ok, requireApiRole } from "@/lib/api";
import { getSocialProvider } from "../../../../../../../server/worker/src/providers/registry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await req.json();
    const { platform, code, redirectUri, state } = body;

    if (!platform || !isPlatformKey(platform)) {
      throw new Error(`Invalid platform: ${platform}`);
    }

    if (!code) {
      throw new Error("Authorization code is required");
    }

    const provider = getSocialProvider(platform as PlatformKey);
    const accountData = await provider.handleCallback({
      code,
      redirectUri: redirectUri || `${process.env.APP_URL || "http://localhost:3000"}/accounts`,
      state,
    });

    const account = await connectSocialAccount(ctx, {
      platform: platform as PlatformKey,
      platformAccountId: accountData.platformAccountId,
      accountName: accountData.accountName,
      accountType: accountData.accountType,
      accessToken: accountData.accessToken,
      refreshToken: accountData.refreshToken,
      tokenExpiresAt: accountData.tokenExpiresAt,
      scopes: accountData.scopes,
    });

    return ok(account);
  } catch (err) {
    return fail(err);
  }
}

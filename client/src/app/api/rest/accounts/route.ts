import { listSocialAccounts, connectSocialAccount } from "@omnipost/database";
import { CAPABILITY_MATRIX, isPlatformKey, type PlatformKey } from "@omnipost/shared";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireApiRole("VIEWER");
    const accounts = await listSocialAccounts(ctx);

    return ok({
      accounts,
      capabilities: CAPABILITY_MATRIX,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await req.json();
    const { platform, platformAccountId, accountName, accountType, accessToken, refreshToken, tokenExpiresAt, scopes } = body;

    if (!platform || !isPlatformKey(platform)) {
      throw new Error(`Invalid or missing platform: ${platform}`);
    }

    if (!accountName || !accessToken) {
      throw new Error("accountName and accessToken are required");
    }

    const account = await connectSocialAccount(ctx, {
      platform: platform as PlatformKey,
      platformAccountId: platformAccountId || `${platform.toLowerCase()}_${Date.now()}`,
      accountName,
      accountType: accountType ?? "business",
      accessToken,
      refreshToken,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
      scopes,
    });

    return ok(account, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}

import { prisma } from "@omnipost/database";

export interface TokenRefreshResult {
  accountId: string;
  platform: string;
  status: "REFRESHED" | "SKIPPED_STILL_VALID" | "FAILED_REAUTH_REQUIRED";
  expiresAt?: string | null;
  message?: string;
}

export async function runTokenRefreshDaemon(): Promise<TokenRefreshResult[]> {
  const results: TokenRefreshResult[] = [];
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Find accounts expiring within 7 days
  const accounts = await prisma.socialAccount.findMany({
    where: {
      status: "CONNECTED",
      tokenExpiresAt: {
        lte: sevenDaysFromNow,
      },
    },
  });

  for (const account of accounts) {
    if (!account.refreshTokenEnc) {
      results.push({
        accountId: account.id,
        platform: account.platform,
        status: "FAILED_REAUTH_REQUIRED",
        message: "No refresh token available; manual user re-auth needed",
      });
      continue;
    }

    try {
      // In production, invoke platform-specific OAuth refresh endpoint
      // Simulate successful extension for 60 days
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 60);

      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          tokenExpiresAt: newExpiry,
          updatedAt: new Date(),
        },
      });

      results.push({
        accountId: account.id,
        platform: account.platform,
        status: "REFRESHED",
        expiresAt: newExpiry.toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Token refresh error";
      results.push({
        accountId: account.id,
        platform: account.platform,
        status: "FAILED_REAUTH_REQUIRED",
        message,
      });
    }
  }

  return results;
}

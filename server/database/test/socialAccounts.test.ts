import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma,
  connectSocialAccount,
  listSocialAccounts,
  getSocialAccount,
  disconnectSocialAccount,
  testAccountHealth,
  getDecryptedAccountTokens,
  type SessionContext,
} from "../src";

describe("Phase 7 Social Accounts & AES-256-GCM Token Encryption", () => {
  let mockContext: SessionContext;
  const sampleToken = "IGQVJXZAk5ZAWlZAOWk2MW9hWnhQY294eWZA4c2E1dUZAvdGlBN";

  beforeAll(async () => {
    process.env.TOKEN_ENCRYPTION_KEY =
      process.env.TOKEN_ENCRYPTION_KEY || "CNZL5Ixfa+ZjJC338gP6+x+VSdSHX6QF12QZLGPYFd0=";

    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Test Org Social", slug: `test-org-social-${Date.now()}` },
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `social-tester-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          name: "Social Tester",
        },
      });
      await prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "ADMIN",
        },
      });
    }

    mockContext = {
      user: { id: user.id, email: user.email, role: "ADMIN", name: "Social Tester" },
      organizationId: org.id,
    };
  });

  it("should connect a social account with encrypted tokens and return sanitized output", async () => {
    const account = await connectSocialAccount(mockContext, {
      platform: "INSTAGRAM",
      platformAccountId: `ig_${Date.now()}`,
      accountName: "@omnipost_official",
      accountType: "business",
      accessToken: sampleToken,
      refreshToken: "refresh_token_sample",
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000), // 60 days
    });

    expect(account.id).toBeDefined();
    expect(account.platform).toBe("INSTAGRAM");
    expect(account.accountName).toBe("@omnipost_official");
    expect(account.status).toBe("CONNECTED");
    expect(account.scopes).toBeDefined();
    expect(account.scopes.length).toBeGreaterThan(0);

    // CRITICAL SECURITY ASSERTION: Plaintext or raw encrypted tokens must NEVER leak to the web layer
    expect((account as Record<string, unknown>).accessToken).toBeUndefined();
    expect((account as Record<string, unknown>).accessTokenEnc).toBeUndefined();
    expect((account as Record<string, unknown>).refreshTokenEnc).toBeUndefined();
  });

  it("should list connected accounts with sanitized metadata", async () => {
    const accounts = await listSocialAccounts(mockContext);
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);

    const found = accounts.find((a) => a.accountName === "@omnipost_official");
    expect(found).toBeDefined();
    expect((found as Record<string, unknown>).accessToken).toBeUndefined();
  });

  it("should test account health and verify encrypted token integrity", async () => {
    const account = await connectSocialAccount(mockContext, {
      platform: "LINKEDIN",
      platformAccountId: `li_${Date.now()}`,
      accountName: "OmniPost Corp",
      accessToken: "linkedin_access_token_12345",
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    });

    const health = await testAccountHealth(mockContext, account.id);
    expect(health.ok).toBe(true);
    expect(health.platform).toBe("LINKEDIN");
    expect(health.message).toContain("valid");
  });

  it("should detect expired tokens during health check", async () => {
    const account = await connectSocialAccount(mockContext, {
      platform: "X",
      platformAccountId: `x_${Date.now()}`,
      accountName: "@omnipost_hq",
      accessToken: "x_access_token_expired",
      tokenExpiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
    });

    const health = await testAccountHealth(mockContext, account.id);
    expect(health.ok).toBe(false);
    expect(health.message).toContain("expired");

    const refreshed = await getSocialAccount(mockContext, account.id);
    expect(refreshed.status).toBe("EXPIRED");
  });

  it("should disconnect an account by transitioning status to REVOKED", async () => {
    const account = await connectSocialAccount(mockContext, {
      platform: "FACEBOOK",
      platformAccountId: `fb_${Date.now()}`,
      accountName: "OmniPost Facebook Page",
      accessToken: "fb_token_to_disconnect",
    });

    const disconnected = await disconnectSocialAccount(mockContext, account.id);
    expect(disconnected.status).toBe("REVOKED");
  });

  it("should allow internal worker to retrieve decrypted platform tokens", async () => {
    const rawSecretToken = "super_secret_raw_oauth_token_777";
    const account = await connectSocialAccount(mockContext, {
      platform: "TIKTOK",
      platformAccountId: `tt_${Date.now()}`,
      accountName: "@omnipost_creations",
      accessToken: rawSecretToken,
    });

    const decrypted = await getDecryptedAccountTokens(mockContext.organizationId, account.id);
    expect(decrypted.platform).toBe("TIKTOK");
    expect(decrypted.accessToken).toBe(rawSecretToken);
  });
});

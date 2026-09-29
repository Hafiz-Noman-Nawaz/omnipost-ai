import { prisma } from "../client";
import { type SessionContext } from "./session-context";
import { writeAudit } from "./audit";
import { encryptToken, decryptToken, type PlatformKey, isPlatformKey, CAPABILITY_MATRIX } from "@omnipost/shared";
import { AppError } from "@omnipost/shared";

function getOrgId(ctx: SessionContext): string {
  return ctx.organizationId ?? (ctx as unknown as { organization?: { id: string } }).organization?.id;
}

export interface ConnectSocialAccountInput {
  platform: PlatformKey;
  platformAccountId: string;
  accountName: string;
  accountType?: string;
  scopes?: string[];
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | string | null;
}

export interface SanitizedSocialAccount {
  id: string;
  organizationId: string;
  platform: PlatformKey;
  platformAccountId: string;
  accountName: string;
  accountType: string | null;
  status: string;
  scopes: string[];
  tokenExpiresAt: Date | null;
  connectedAt: Date;
  lastActionAt: Date | null;
  lastActionOk: boolean | null;
  lastError: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sanitizes a social account record by omitting sensitive encrypted tokens.
 */
function sanitizeAccount(acc: {
  id: string;
  organizationId: string;
  platform: string;
  platformAccountId: string;
  accountName: string;
  accountType: string | null;
  status: string;
  scopes: string[];
  tokenExpiresAt: Date | null;
  connectedAt: Date;
  lastActionAt: Date | null;
  lastActionOk: boolean | null;
  lastError: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SanitizedSocialAccount {
  return {
    id: acc.id,
    organizationId: acc.organizationId,
    platform: acc.platform as PlatformKey,
    platformAccountId: acc.platformAccountId,
    accountName: acc.accountName,
    accountType: acc.accountType,
    status: acc.status,
    scopes: acc.scopes,
    tokenExpiresAt: acc.tokenExpiresAt,
    connectedAt: acc.connectedAt,
    lastActionAt: acc.lastActionAt,
    lastActionOk: acc.lastActionOk,
    lastError: acc.lastError,
    createdAt: acc.createdAt,
    updatedAt: acc.updatedAt,
  };
}

/**
 * Lists all connected social accounts for the user's organization.
 * Plaintext tokens are NEVER included.
 */
export async function listSocialAccounts(ctx: SessionContext): Promise<SanitizedSocialAccount[]> {
  const orgId = getOrgId(ctx);
  const accounts = await prisma.socialAccount.findMany({
    where: { organizationId: orgId },
    orderBy: { connectedAt: "desc" },
  });

  return accounts.map(sanitizeAccount);
}

/**
 * Gets a single social account by ID.
 */
export async function getSocialAccount(ctx: SessionContext, id: string): Promise<SanitizedSocialAccount> {
  const orgId = getOrgId(ctx);
  const account = await prisma.socialAccount.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!account) {
    throw new AppError("NOT_FOUND", `Social account ${id} not found.`);
  }

  return sanitizeAccount(account);
}

/**
 * Connects or updates a social account with AES-256-GCM encrypted tokens.
 */
export async function connectSocialAccount(
  ctx: SessionContext,
  input: ConnectSocialAccountInput,
): Promise<SanitizedSocialAccount> {
  const orgId = getOrgId(ctx);

  if (!isPlatformKey(input.platform)) {
    throw new AppError("VALIDATION_ERROR", `Unsupported platform: ${input.platform}`);
  }

  if (!input.platformAccountId || !input.accountName || !input.accessToken) {
    throw new AppError("VALIDATION_ERROR", "Missing required social account connection details.");
  }

  const accessTokenEnc = encryptToken(input.accessToken);
  const refreshTokenEnc = input.refreshToken ? encryptToken(input.refreshToken) : null;
  const scopes = input.scopes && input.scopes.length > 0 ? input.scopes : CAPABILITY_MATRIX[input.platform].defaultScopes;
  const tokenExpiresAt = input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null;

  const account = await prisma.socialAccount.upsert({
    where: {
      organizationId_platform_platformAccountId: {
        organizationId: orgId,
        platform: input.platform,
        platformAccountId: input.platformAccountId,
      },
    },
    create: {
      organizationId: orgId,
      platform: input.platform,
      platformAccountId: input.platformAccountId,
      accountName: input.accountName,
      accountType: input.accountType ?? "business",
      status: "CONNECTED",
      scopes,
      accessTokenEnc: new Uint8Array(accessTokenEnc),
      refreshTokenEnc: refreshTokenEnc ? new Uint8Array(refreshTokenEnc) : null,
      tokenExpiresAt,
      lastActionAt: new Date(),
      lastActionOk: true,
      lastError: null as unknown as object,
    },
    update: {
      accountName: input.accountName,
      accountType: input.accountType ?? undefined,
      status: "CONNECTED",
      scopes,
      accessTokenEnc: new Uint8Array(accessTokenEnc),
      refreshTokenEnc: refreshTokenEnc ? new Uint8Array(refreshTokenEnc) : null,
      tokenExpiresAt,
      lastActionAt: new Date(),
      lastActionOk: true,
      lastError: null as unknown as object,
    },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "social_account.connected",
    resourceType: "social_account",
    resourceId: account.id,
    metadata: {
      platform: input.platform,
      platformAccountId: input.platformAccountId,
      accountName: input.accountName,
      scopes,
    },
  });

  return sanitizeAccount(account);
}

/**
 * Disconnects (revokes) a social account.
 */
export async function disconnectSocialAccount(ctx: SessionContext, id: string): Promise<SanitizedSocialAccount> {
  const orgId = getOrgId(ctx);
  const account = await prisma.socialAccount.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!account) {
    throw new AppError("NOT_FOUND", `Social account ${id} not found.`);
  }

  const updated = await prisma.socialAccount.update({
    where: { id },
    data: {
      status: "REVOKED",
      lastActionAt: new Date(),
      lastActionOk: false,
      lastError: { message: "Account disconnected by user" } as unknown as object,
    },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "social_account.disconnected",
    resourceType: "social_account",
    resourceId: id,
    metadata: {
      platform: account.platform,
      accountName: account.accountName,
    },
  });

  return sanitizeAccount(updated);
}

/**
 * Tests decryption and connection health of an account.
 */
export async function testAccountHealth(
  ctx: SessionContext,
  id: string,
): Promise<{ ok: boolean; platform: string; message: string; tokenExpiresAt: Date | null }> {
  const orgId = getOrgId(ctx);
  const account = await prisma.socialAccount.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!account) {
    throw new AppError("NOT_FOUND", `Social account ${id} not found.`);
  }

  try {
    const decryptedToken = decryptToken(account.accessTokenEnc);
    if (!decryptedToken || decryptedToken.length === 0) {
      throw new Error("Decrypted token is empty.");
    }

    const isExpired = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() < Date.now() : false;
    const status = isExpired ? "EXPIRED" : "CONNECTED";

    await prisma.socialAccount.update({
      where: { id },
      data: {
        status,
        lastActionAt: new Date(),
        lastActionOk: !isExpired,
        lastError: isExpired ? ({ message: "Token has expired." } as unknown as object) : null as unknown as object,
      },
    });

    return {
      ok: !isExpired,
      platform: account.platform,
      message: isExpired ? "Token has expired and requires reconnection." : "Account connection and encrypted credentials are valid.",
      tokenExpiresAt: account.tokenExpiresAt,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Decryption failed";
    await prisma.socialAccount.update({
      where: { id },
      data: {
        status: "ERROR",
        lastActionAt: new Date(),
        lastActionOk: false,
        lastError: { message: errorMsg } as unknown as object,
      },
    });

    return {
      ok: false,
      platform: account.platform,
      message: `Credential validation error: ${errorMsg}`,
      tokenExpiresAt: account.tokenExpiresAt,
    };
  }
}

/**
 * Internal-only worker function to retrieve decrypted platform credentials for publishing.
 * NEVER call or expose through client-facing REST APIs!
 */
export async function getDecryptedAccountTokens(orgId: string, socialAccountId: string): Promise<{
  platform: PlatformKey;
  accessToken: string;
  refreshToken?: string;
  accountName: string;
  platformAccountId: string;
}> {
  const account = await prisma.socialAccount.findFirst({
    where: { id: socialAccountId, organizationId: orgId },
  });

  if (!account) {
    throw new AppError("NOT_FOUND", `Social account ${socialAccountId} not found.`);
  }

  if (account.status !== "CONNECTED") {
    throw new AppError("VALIDATION_ERROR", `Social account ${account.accountName} is ${account.status}.`);
  }

  const accessToken = decryptToken(account.accessTokenEnc);
  const refreshToken = account.refreshTokenEnc ? decryptToken(account.refreshTokenEnc) : undefined;

  return {
    platform: account.platform as PlatformKey,
    accessToken,
    refreshToken,
    accountName: account.accountName,
    platformAccountId: account.platformAccountId,
  };
}

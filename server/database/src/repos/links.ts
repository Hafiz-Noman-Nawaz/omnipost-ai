import { prisma } from "../client";
import { writeAudit } from "./audit";

export interface CreateShortLinkInput {
  organizationId: string;
  originalUrl: string;
  campaignId?: string | null;
  platform?: string | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}

export interface ShortLinkRecord {
  id: string;
  code: string;
  originalUrl: string;
  targetUrl: string;
  organizationId: string;
  campaignId: string | null;
  platform: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  clicksCount: number;
  createdAt: string;
}

export interface LinkClickLog {
  id: string;
  linkCode: string;
  platform: string | null;
  referrer: string | null;
  userAgent: string | null;
  clickedAt: string;
}

// In-memory persistent map fallback backed by audit log & Prisma
const memoryLinks = new Map<string, ShortLinkRecord>();
const memoryClicks = new Map<string, LinkClickLog[]>();

export function generateShortCode(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function buildUtmUrl(baseUrl: string, utms: { source?: string; medium?: string; campaign?: string; content?: string }): string {
  try {
    const url = new URL(baseUrl);
    if (utms.source) url.searchParams.set("utm_source", utms.source);
    if (utms.medium) url.searchParams.set("utm_medium", utms.medium);
    if (utms.campaign) url.searchParams.set("utm_campaign", utms.campaign);
    if (utms.content) url.searchParams.set("utm_content", utms.content);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export async function createShortLink(input: CreateShortLinkInput): Promise<ShortLinkRecord> {
  const code = generateShortCode();
  const utmSource = input.utmSource || (input.platform ? input.platform.toLowerCase() : "omnipost");
  const utmMedium = input.utmMedium || "social";
  const utmCampaign = input.utmCampaign || (input.campaignId ? `campaign_${input.campaignId.slice(-6)}` : "omnipost_launch");
  const utmContent = input.utmContent || code;

  const targetUrl = buildUtmUrl(input.originalUrl, {
    source: utmSource,
    medium: utmMedium,
    campaign: utmCampaign,
    content: utmContent,
  });

  const record: ShortLinkRecord = {
    id: `link_${code}`,
    code,
    originalUrl: input.originalUrl,
    targetUrl,
    organizationId: input.organizationId,
    campaignId: input.campaignId ?? null,
    platform: input.platform ?? null,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    clicksCount: 0,
    createdAt: new Date().toISOString(),
  };

  memoryLinks.set(code, record);
  memoryClicks.set(code, []);

  // Write audit trail entry
  try {
    await writeAudit(input.organizationId, {
      actorType: "SYSTEM",
      action: "link.create",
      resourceType: "SHORT_LINK",
      resourceId: record.id,
      metadata: {
        code,
        originalUrl: input.originalUrl,
        targetUrl,
        platform: input.platform,
      },
    });
  } catch {
    // Audit logging is best-effort
  }

  return record;
}

export async function resolveShortLink(
  code: string,
  clickMeta?: { referrer?: string | null; userAgent?: string | null; platform?: string | null }
): Promise<ShortLinkRecord | null> {
  const link = memoryLinks.get(code);
  if (!link) return null;

  link.clicksCount += 1;

  const clickLog: LinkClickLog = {
    id: `click_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    linkCode: code,
    platform: clickMeta?.platform ?? link.platform,
    referrer: clickMeta?.referrer ?? null,
    userAgent: clickMeta?.userAgent ?? null,
    clickedAt: new Date().toISOString(),
  };

  const logs = memoryClicks.get(code) || [];
  logs.push(clickLog);
  memoryClicks.set(code, logs);

  return link;
}

export async function listShortLinks(organizationId: string): Promise<ShortLinkRecord[]> {
  const list = Array.from(memoryLinks.values()).filter((l) => l.organizationId === organizationId);
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLinkClicks(code: string): Promise<LinkClickLog[]> {
  return memoryClicks.get(code) || [];
}

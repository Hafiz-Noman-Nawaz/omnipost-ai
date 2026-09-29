/**
 * Supported publishing platforms (docs/04 §5 PlatformKey).
 * Pure constants — safe to import from client components, unlike the
 * database package which pulls in the Prisma client.
 */

export const PLATFORM_KEYS = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "TIKTOK",
  "X",
  "YOUTUBE",
] as const;

export type PlatformKey = (typeof PLATFORM_KEYS)[number];

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
};

export function isPlatformKey(value: string): value is PlatformKey {
  return (PLATFORM_KEYS as readonly string[]).includes(value);
}

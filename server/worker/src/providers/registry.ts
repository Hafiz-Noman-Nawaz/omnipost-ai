import { type PlatformKey } from "@omnipost/shared";
import { type SocialProvider } from "./types";
import { InstagramProvider } from "./instagram";
import { LinkedInProvider } from "./linkedin";
import { FacebookProvider } from "./facebook";
import { TikTokProvider } from "./tiktok";
import { XProvider } from "./x";
import { YouTubeProvider } from "./youtube";

const providers: Record<PlatformKey, SocialProvider> = {
  INSTAGRAM: new InstagramProvider(),
  LINKEDIN: new LinkedInProvider(),
  FACEBOOK: new FacebookProvider(),
  TIKTOK: new TikTokProvider(),
  X: new XProvider(),
  YOUTUBE: new YouTubeProvider(),
};

export function getSocialProvider(platform: PlatformKey | string): SocialProvider {
  const normPlatform = platform.toUpperCase() as PlatformKey;
  const provider = providers[normPlatform];
  if (!provider) {
    throw new Error(`No provider registered for platform: ${platform}`);
  }
  return provider;
}

export * from "./types";
export * from "./instagram";
export * from "./linkedin";
export * from "./facebook";
export * from "./tiktok";
export * from "./x";
export * from "./youtube";
export * from "./generic";

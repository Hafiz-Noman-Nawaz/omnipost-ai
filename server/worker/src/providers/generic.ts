import { type PlatformKey, CAPABILITY_MATRIX, type CapabilityMatrix } from "@omnipost/shared";
import {
  type SocialProvider,
  type ConnectInput,
  type ConnectResult,
  type CallbackInput,
  type ConnectedAccountData,
  type PublishMediaPayload,
  type ProviderPublishResult,
} from "./types";

export class GenericSocialProvider implements SocialProvider {
  readonly platform: PlatformKey;
  readonly capabilities: CapabilityMatrix;

  constructor(platform: PlatformKey) {
    this.platform = platform;
    this.capabilities = CAPABILITY_MATRIX[platform];
  }

  async connect(input: ConnectInput): Promise<ConnectResult> {
    const state = input.state || `${this.platform.toLowerCase()}_oauth_${Date.now()}`;
    const scopes = encodeURIComponent(this.capabilities.defaultScopes.join(" "));

    const baseUrls: Record<PlatformKey, string> = {
      INSTAGRAM: "https://www.facebook.com/v19.0/dialog/oauth",
      FACEBOOK: "https://www.facebook.com/v19.0/dialog/oauth",
      LINKEDIN: "https://www.linkedin.com/oauth/v2/authorization",
      TIKTOK: "https://www.tiktok.com/v2/auth/authorize/",
      X: "https://twitter.com/i/oauth2/authorize",
      YOUTUBE: "https://accounts.google.com/o/oauth2/v2/auth",
    };

    const url = new URL(baseUrls[this.platform]);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);

    return {
      authorizationUrl: url.toString(),
      state,
    };
  }

  async handleCallback(input: CallbackInput): Promise<ConnectedAccountData> {
    return {
      platformAccountId: `${this.platform.toLowerCase()}_${Date.now()}`,
      accountName: `@omnipost_${this.platform.toLowerCase()}`,
      accountType: this.platform === "FACEBOOK" ? "page" : "business",
      accessToken: `${this.platform.toLowerCase()}_tok_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      refreshToken: `${this.platform.toLowerCase()}_refresh_${Date.now()}`,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000), // 60 days
      scopes: this.capabilities.defaultScopes,
    };
  }

  async validateCredentials(tokens: { accessToken: string; tokenExpiresAt?: Date | null }): Promise<boolean> {
    if (!tokens.accessToken) return false;
    if (tokens.tokenExpiresAt && new Date(tokens.tokenExpiresAt).getTime() < Date.now()) {
      return false;
    }
    return true;
  }

  async publish(payload: PublishMediaPayload): Promise<ProviderPublishResult> {
    // 1. Check caption length
    if (payload.caption.length > this.capabilities.media.maxCaptionLength) {
      return {
        ok: false,
        error: {
          code: "CAPTION_TOO_LONG",
          message: `${this.platform} caption exceeds max length of ${this.capabilities.media.maxCaptionLength} characters.`,
          retryable: false,
        },
      };
    }

    // 2. Check hashtags count
    if (payload.hashtags.length > this.capabilities.media.maxHashtags) {
      return {
        ok: false,
        error: {
          code: "TOO_MANY_HASHTAGS",
          message: `${this.platform} allows a maximum of ${this.capabilities.media.maxHashtags} hashtags.`,
          retryable: false,
        },
      };
    }

    // 3. Check simulated failure hook
    if (payload.caption.includes("[SIMULATE_FAILURE]")) {
      return {
        ok: false,
        error: {
          code: "PLATFORM_RATE_LIMITED",
          message: `${this.platform} rate limit exceeded. Retry later.`,
          retryable: true,
        },
      };
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return {
      ok: true,
      platformPostId: `${this.platform.toLowerCase()}_pub_${Date.now()}_${randomSuffix}`,
    };
  }

  mapError(err: unknown): { code: string; message: string; retryable: boolean } {
    return {
      code: `${this.platform}_ERROR`,
      message: (err as Error)?.message || `Publishing to ${this.platform} failed.`,
      retryable: true,
    };
  }
}

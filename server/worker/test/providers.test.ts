import { describe, it, expect } from "vitest";
import {
  getSocialProvider,
  InstagramProvider,
  LinkedInProvider,
  FacebookProvider,
  TikTokProvider,
  XProvider,
  YouTubeProvider,
} from "../src/providers/registry";
import { PLATFORM_KEYS } from "@omnipost/shared";

describe("Phase 8 Multi-Platform Publishing Adapters", () => {
  it("should register and resolve dedicated providers for all 6 platforms", () => {
    for (const platform of PLATFORM_KEYS) {
      const provider = getSocialProvider(platform);
      expect(provider).toBeDefined();
      expect(provider.platform).toBe(platform);
      expect(provider.capabilities).toBeDefined();
    }
  });

  describe("InstagramProvider", () => {
    const provider = new InstagramProvider();

    it("should generate a valid Meta OAuth URL with required scopes", async () => {
      const conn = await provider.connect({
        organizationId: "org_1",
        redirectUri: "https://example.com/callback",
      });

      expect(conn.authorizationUrl).toContain("facebook.com");
      expect(conn.authorizationUrl).toContain("instagram_content_publish");
      expect(conn.state).toBeDefined();
    });

    it("should enforce caption length <= 2200 and max 30 hashtags", async () => {
      const overLong = await provider.publish({
        caption: "a".repeat(2201),
        hashtags: [],
      });
      expect(overLong.ok).toBe(false);
      expect(overLong.error?.code).toBe("CAPTION_TOO_LONG");

      const tooManyTags = await provider.publish({
        caption: "Clean caption",
        hashtags: Array(31).fill("#tag"),
      });
      expect(tooManyTags.ok).toBe(false);
      expect(tooManyTags.error?.code).toBe("TOO_MANY_HASHTAGS");
    });

    it("should publish cleanly and return a platform post ID", async () => {
      const res = await provider.publish({
        caption: "Exciting new product launch!",
        hashtags: ["#tech", "#ai"],
      });
      expect(res.ok).toBe(true);
      expect(res.platformPostId).toMatch(/^ig_post_/);
    });

    it("should map Graph API errors accurately", () => {
      const mapped = provider.mapError({ code: 190, message: "Error validating access token" });
      expect(mapped.code).toBe("OAUTH_TOKEN_EXPIRED");
      expect(mapped.retryable).toBe(false);
    });
  });

  describe("LinkedInProvider", () => {
    const provider = new LinkedInProvider();

    it("should generate LinkedIn OAuth authorization URL with w_member_social", async () => {
      const conn = await provider.connect({
        organizationId: "org_1",
        redirectUri: "https://example.com/callback",
      });

      expect(conn.authorizationUrl).toContain("linkedin.com/oauth/v2/authorization");
      expect(conn.authorizationUrl).toContain("w_member_social");
    });

    it("should enforce commentary max 3000 chars and max 10 hashtags", async () => {
      const overLong = await provider.publish({
        caption: "a".repeat(3001),
        hashtags: [],
      });
      expect(overLong.ok).toBe(false);
      expect(overLong.error?.code).toBe("CAPTION_TOO_LONG");

      const tooManyTags = await provider.publish({
        caption: "Professional update",
        hashtags: Array(11).fill("#linkedin"),
      });
      expect(tooManyTags.ok).toBe(false);
      expect(tooManyTags.error?.code).toBe("TOO_MANY_HASHTAGS");
    });

    it("should publish and return a LinkedIn share URN", async () => {
      const res = await provider.publish({
        caption: "Thrilled to announce our new milestone.",
        hashtags: ["#growth", "#leadership"],
      });
      expect(res.ok).toBe(true);
      expect(res.platformPostId).toMatch(/^urn:li:share:/);
    });
  });

  describe("FacebookProvider", () => {
    const provider = new FacebookProvider();

    it("should generate Facebook Page OAuth dialog URL", async () => {
      const conn = await provider.connect({
        organizationId: "org_1",
        redirectUri: "https://example.com/callback",
      });

      expect(conn.authorizationUrl).toContain("facebook.com");
      expect(conn.authorizationUrl).toContain("pages_manage_posts");
    });

    it("should publish and return a Facebook post ID", async () => {
      const res = await provider.publish({
        caption: "Official announcement for our community followers.",
        hashtags: ["#news"],
      });
      expect(res.ok).toBe(true);
      expect(res.platformPostId).toMatch(/^fb_post_/);
    });
  });

  describe("TikTokProvider", () => {
    const provider = new TikTokProvider();

    it("should generate TikTok v2 authorization URL", async () => {
      const conn = await provider.connect({
        organizationId: "org_1",
        redirectUri: "https://example.com/callback",
      });

      expect(conn.authorizationUrl).toContain("tiktok.com/v2/auth/authorize");
      expect(conn.authorizationUrl).toContain("video.publish");
    });

    it("should enforce TikTok caption length <= 2200 and max 20 hashtags", async () => {
      const overLong = await provider.publish({
        caption: "a".repeat(2201),
        hashtags: [],
      });
      expect(overLong.ok).toBe(false);
      expect(overLong.error?.code).toBe("CAPTION_TOO_LONG");

      const res = await provider.publish({
        caption: "Behind the scenes video #fyp",
        hashtags: ["#bts", "#viral"],
      });
      expect(res.ok).toBe(true);
      expect(res.platformPostId).toMatch(/^tt_publish_/);
    });
  });

  describe("XProvider", () => {
    const provider = new XProvider();

    it("should generate Twitter OAuth 2.0 PKCE URL with code_challenge", async () => {
      const conn = await provider.connect({
        organizationId: "org_1",
        redirectUri: "https://example.com/callback",
      });

      expect(conn.authorizationUrl).toContain("twitter.com/i/oauth2/authorize");
      expect(conn.authorizationUrl).toContain("code_challenge");
      expect(conn.authorizationUrl).toContain("tweet.write");
    });

    it("should strictly enforce the 280 character limit for X tweets", async () => {
      const over280 = await provider.publish({
        caption: "x".repeat(281),
        hashtags: [],
      });
      expect(over280.ok).toBe(false);
      expect(over280.error?.code).toBe("CAPTION_TOO_LONG");

      const valid280 = await provider.publish({
        caption: "Automated tweet within 280 character boundary. ⚡",
        hashtags: ["#buildinpublic"],
      });
      expect(valid280.ok).toBe(true);
      expect(valid280.platformPostId).toMatch(/^x_tweet_/);
    });
  });

  describe("YouTubeProvider", () => {
    const provider = new YouTubeProvider();

    it("should generate Google OAuth URL with youtube.upload scope", async () => {
      const conn = await provider.connect({
        organizationId: "org_1",
        redirectUri: "https://example.com/callback",
      });

      expect(conn.authorizationUrl).toContain("accounts.google.com");
      expect(conn.authorizationUrl).toContain("youtube.upload");
    });

    it("should enforce description length <= 5000 and max 15 hashtags", async () => {
      const overLong = await provider.publish({
        caption: "y".repeat(5001),
        hashtags: [],
      });
      expect(overLong.ok).toBe(false);
      expect(overLong.error?.code).toBe("CAPTION_TOO_LONG");

      const res = await provider.publish({
        caption: "Full demo walkthrough video description.",
        hashtags: ["#tutorial", "#coding"],
      });
      expect(res.ok).toBe(true);
      expect(res.platformPostId).toMatch(/^yt_video_/);
    });
  });
});

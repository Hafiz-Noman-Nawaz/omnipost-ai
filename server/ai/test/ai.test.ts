import { describe, it, expect } from "vitest";
import { MockLLMProvider } from "../src/mock-provider";
import { screenCaption, enforceDisclosure, CAPTION_LIMITS } from "../src/guardrails";
import { CAPTION_PROMPT, CAPTION_OUTPUT_SCHEMA } from "../src/prompts";

describe("Phase 4 AI Content Generation & Safety Guardrails", () => {
  const provider = new MockLLMProvider();

  it("should generate platform-specific captions with hooks and hashtags", async () => {
    const promptInput = {
      platform: "X",
      title: "Mechanical Keyboard",
      description: "Custom mechanical keyboard for programmers",
      contentType: "IMAGE",
    };

    const res = await provider.complete({
      system: CAPTION_PROMPT.system,
      user: CAPTION_PROMPT.buildUser(promptInput),
      outputSchema: CAPTION_OUTPUT_SCHEMA,
    });

    expect(res.output).toBeDefined();
    const parsed = res.output as { caption: string; hook?: string; hashtags: string[] };
    expect(parsed.caption).toBeTruthy();
    expect(parsed.hashtags).toBeInstanceOf(Array);
    expect(parsed.caption.length).toBeLessThanOrEqual(CAPTION_LIMITS.X);
  });

  it("should screen out fabricated claims (price, discount, guarantee)", () => {
    const dangerousOutput = {
      hook: "Get rich now",
      caption: "Only $49.99 today with 50% discount! Guaranteed results.",
      cta: "Buy now",
      hashtags: ["#deals"],
    };

    const result = screenCaption("X", dangerousOutput);
    expect(result.ok).toBe(false);
    expect(result.flags.some((f) => f.code === "BANNED_CLAIM")).toBe(true);
  });

  it("should screen out brand avoid terms", () => {
    const output = {
      caption: "This is a cheap knockoff device for your desk.",
      hashtags: ["#tech"],
    };

    const result = screenCaption("INSTAGRAM", output, { avoidTerms: ["cheap"] });
    expect(result.ok).toBe(false);
    expect(result.flags.some((f) => f.code === "AVOID_TERM")).toBe(true);
  });

  it("should enforce mandatory affiliate disclosure if specified", () => {
    const output = {
      caption: "Check out this great monitor setup.",
      hashtags: ["#setup"],
    };

    const disclosure = "#Ad (affiliate link)";
    const screened = screenCaption("LINKEDIN", output, { disclosureText: disclosure });
    expect(screened.ok).toBe(false);
    expect(screened.flags.some((f) => f.code === "DISCLOSURE_MISSING")).toBe(true);

    const enforced = enforceDisclosure(output, disclosure);
    expect(enforced.caption).toContain(disclosure);
  });

  it("should flag captions exceeding platform character limits", () => {
    const longText = "A".repeat(300);
    const output = {
      caption: longText,
      hashtags: [],
    };

    const result = screenCaption("X", output);
    expect(result.ok).toBe(false);
    expect(result.flags.some((f) => f.code === "TOO_LONG")).toBe(true);
  });

  it("should classify comment intent, sentiment, and detect spam/abuse safety flags", async () => {
    const questionRes = await provider.complete({
      system: "comment classifier",
      user: "Classify the following social media comment: DATA: " + JSON.stringify({
        platform: "INSTAGRAM",
        commentText: "How much does shipping cost to Canada? Is there a discount code?",
        authorName: "sarah_dev",
      }),
    });
    expect(questionRes.output).toBeDefined();
    const qData = questionRes.output as any;
    expect(qData.intent).toBe("PRICING");
    expect(qData.confidence).toBeGreaterThan(0.8);

    const spamRes = await provider.complete({
      system: "comment classifier",
      user: "Classify the following social media comment: DATA: " + JSON.stringify({
        platform: "X",
        commentText: "DM me for free crypto and instant money back guarantee!",
        authorName: "bot_123",
      }),
    });
    const sData = spamRes.output as any;
    expect(sData.intent).toBe("SPAM");
    expect(sData.safetyFlags).toContain("spam_detected");

    const abuseRes = await provider.complete({
      system: "comment classifier",
      user: "Classify the following social media comment: DATA: " + JSON.stringify({
        platform: "FACEBOOK",
        commentText: "I hate this you idiot trash scammer!",
        authorName: "troll_99",
      }),
    });
    const aData = abuseRes.output as any;
    expect(aData.intent).toBe("ABUSE");
    expect(aData.safetyFlags).toContain("toxic_language");
  });

  it("should generate contextual reply suggestions for classified comments", async () => {
    const res = await provider.complete({
      system: "reply suggester",
      user: "Generate reply suggestions: DATA: " + JSON.stringify({
        platform: "LINKEDIN",
        commentText: "What are the key integration capabilities?",
        intent: "QUESTION",
        sentiment: "NEUTRAL",
        brandName: "OmniPost",
        productLink: "https://omnipost.dev/docs",
      }),
    });
    expect(res.output).toBeDefined();
    const out = res.output as any;
    expect(out.suggestions).toBeInstanceOf(Array);
    expect(out.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(out.suggestions[0].text).toBeTruthy();
    expect(out.suggestions[0].tone).toBeTruthy();
  });

  it("should generate grounded analytics performance summaries and identify data gaps", async () => {
    const { summarizeAnalytics } = await import("../src");
    const summary = await summarizeAnalytics(provider, {
      timeframe: "Past 30 days",
      campaignName: "Spring Launch",
      campaignGoal: "Brand Awareness",
      totalPosts: 12,
      totals: {
        views: 24500,
        likes: 1850,
        comments: 240,
        shares: 110,
        clicks: 85,
      },
      platformBreakdown: [
        {
          platform: "INSTAGRAM",
          views: 12000,
          likes: 950,
          comments: 140,
          shares: 60,
          postsCount: 6,
          missingMetrics: ["clicks", "retweets"],
        },
        {
          platform: "LINKEDIN",
          views: 8500,
          likes: 420,
          comments: 65,
          clicks: 85,
          postsCount: 4,
          missingMetrics: ["shares", "retweets"],
        },
      ],
      userQuestion: "Which channel drove the strongest impressions?",
    });

    expect(summary.summary).toBeTruthy();
    expect(summary.summary).toContain("24500 views");
    expect(summary.topHighlights.length).toBeGreaterThanOrEqual(1);
    expect(summary.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(summary.dataGapsOrCaveats.length).toBeGreaterThanOrEqual(1);
    expect(summary.dataGapsOrCaveats[0]).toContain("INSTAGRAM");
  });

  it("should refuse unsupported ROI/revenue claims when asked", async () => {
    const { summarizeAnalytics } = await import("../src");
    const summary = await summarizeAnalytics(provider, {
      totalPosts: 5,
      totals: { views: 5000, likes: 200, comments: 20 },
      platformBreakdown: [{ platform: "X", views: 5000, likes: 200, comments: 20, postsCount: 5 }],
      userQuestion: "Can we claim a 400% ROI from these tweets?",
    });

    expect(summary.summary).toContain("strictly refuses unsupported financial or conversion claims");
  });
});


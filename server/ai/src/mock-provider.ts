import { LLMError, parseJsonOutput } from "./port";
import type { CompleteRequest, CompleteResponse, LLMProvider } from "./port";

/**
 * Deterministic mock provider (docs/05 §4 FakeLLMProvider). Used when no API
 * key is configured so the whole pipeline is runnable and testable without
 * network or cost. It composes output from the actual input data, so tests can
 * assert on constraints (platform, disclosure, avoid-terms) deterministically.
 */

export interface MockCall {
  system: string;
  user: string;
  at: number;
}

export class MockLLMProvider implements LLMProvider {
  readonly id = "mock";
  readonly model: string;
  /** Call log for tests. */
  readonly calls: MockCall[] = [];
  /** Optional queue of scripted raw responses (FIFO); falls back to synthesis. */
  private script: string[] = [];

  constructor(model = "mock-1") {
    this.model = model;
  }

  /** Queue raw responses; each is parsed like a real provider response would be. */
  scriptResponses(...raw: string[]) {
    this.script.push(...raw);
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    this.calls.push({ system: req.system, user: req.user, at: Date.now() });

    if (this.script.length > 0) {
      const raw = this.script.shift()!;
      const output = req.outputSchema ? parseJsonOutput(raw, req.outputSchema) : parseJsonOutput(raw);
      return { output, raw, model: this.model, provider: this.id };
    }

    const raw = JSON.stringify(this.synthesize(req));
    const output = req.outputSchema ? parseJsonOutput(raw, req.outputSchema) : parseJsonOutput(raw);
    return {
      output,
      raw,
      model: this.model,
      provider: this.id,
      usage: { inputTokens: Math.ceil((req.system.length + req.user.length) / 4), outputTokens: Math.ceil(raw.length / 4) },
    };
  }

  /**
   * Build a plausible caption package from the prompt's structured payload.
   * The generation service embeds a JSON "DATA" block; we reuse its values so
   * the mock reflects the real inputs (platform, disclosure, campaign, etc.).
   */
  private synthesize(req: CompleteRequest): unknown {
    const data = extractDataBlock(req.user) ?? {};
    const platform = typeof data.platform === "string" ? data.platform : "X";

    // Handle comment classification
    if (req.user.includes("Classify the following social media comment") || (data.commentText && !req.user.includes("reply suggestions"))) {
      const text = typeof data.commentText === "string" ? data.commentText.toLowerCase() : "";
      let intent = "GENERAL";
      let sentiment = "NEUTRAL";
      const safetyFlags: string[] = [];

      if (text.includes("hate") || text.includes("idiot") || text.includes("trash") || text.includes("scum") || text.includes("die")) {
        intent = "ABUSE";
        sentiment = "NEGATIVE";
        safetyFlags.push("toxic_language");
      } else if (text.includes("scam") || text.includes("crypto") || text.includes("dm me") || text.includes("follow back") || text.includes("free money")) {
        intent = "SPAM";
        sentiment = "NEGATIVE";
        safetyFlags.push("spam_detected");
      } else if (text.includes("broken") || text.includes("terrible") || text.includes("refund") || text.includes("worst") || text.includes("fail")) {
        intent = "COMPLAINT";
        sentiment = "NEGATIVE";
      } else if (text.includes("price") || text.includes("cost") || text.includes("$") || text.includes("discount") || text.includes("pricing")) {
        intent = "PRICING";
        sentiment = "NEUTRAL";
      } else if (text.includes("buy") || text.includes("order") || text.includes("purchase") || text.includes("cart") || text.includes("checkout")) {
        intent = "PURCHASE_INTENT";
        sentiment = "POSITIVE";
      } else if (text.includes("collab") || text.includes("sponsor") || text.includes("partner")) {
        intent = "PARTNERSHIP";
        sentiment = "POSITIVE";
      } else if (text.includes("?") || text.includes("how") || text.includes("what") || text.includes("when") || text.includes("where")) {
        intent = "QUESTION";
        sentiment = "NEUTRAL";
      } else if (text.includes("love") || text.includes("awesome") || text.includes("great") || text.includes("amazing") || text.includes("cool")) {
        intent = "POSITIVE";
        sentiment = "POSITIVE";
      } else if (text.includes("bad") || text.includes("dislike") || text.includes("disappointed")) {
        intent = "NEGATIVE";
        sentiment = "NEGATIVE";
      }

      return {
        intent,
        confidence: 0.94,
        sentiment,
        safetyFlags,
        reason: `Synthesized classification for intent ${intent}`,
      };
    }

    // Handle reply suggestions
    if (req.user.includes("Generate reply suggestions") || req.system.includes("reply suggester")) {
      const brand = typeof data.brandName === "string" ? data.brandName : "OmniPost";
      const intent = typeof data.intent === "string" ? data.intent : "GENERAL";
      return {
        suggestions: [
          {
            text: `Hi ${data.authorName || "there"}! Thanks for reaching out to ${brand}. We appreciate your engagement!`,
            tone: "Friendly & Warm",
            confidence: 0.95,
          },
          {
            text: `Hello! Check out our latest update at ${data.productLink || "our official link"} for more details.`,
            tone: "Informative & Direct",
            confidence: 0.88,
          },
          {
            text: `Great question regarding ${intent.toLowerCase()}. Feel free to DM us if you have any questions!`,
            tone: "Helpful & Proactive",
            confidence: 0.91,
          },
        ],
      };
    }

    // Handle analytics summarizer
    if (req.user.includes("Summarize performance based strictly on the provided real metrics") || req.system.includes("analytics intelligence advisor")) {
      const totals = (data.totals ?? {}) as Record<string, number | undefined>;
      const platforms = Array.isArray(data.platformBreakdown) ? data.platformBreakdown : [];
      const totalPosts = typeof data.totalPosts === "number" ? data.totalPosts : 0;
      const question = typeof data.userQuestion === "string" ? data.userQuestion : "";

      const caveats: string[] = [];
      platforms.forEach((p: any) => {
        if (Array.isArray(p.missingMetrics) && p.missingMetrics.length > 0) {
          caveats.push(`${p.platform}: Metrics not supported by platform API (${p.missingMetrics.join(", ")}).`);
        }
      });

      let summary = `Tracked ${totalPosts} post(s) delivering a verified total of ${totals.views ?? 0} views, ${totals.likes ?? 0} likes, and ${totals.comments ?? 0} comments across ${platforms.length} connected channel(s).`;
      if (question) {
        if (question.toLowerCase().includes("roi") || question.toLowerCase().includes("revenue") || question.toLowerCase().includes("conversion rate")) {
          summary += ` (Regarding '${question}': OmniPost strictly refuses unsupported financial or conversion claims as direct revenue tracking is not configured in the metrics dataset.)`;
        } else {
          summary += ` Analysis specifically addresses your query on '${question}'.`;
        }
      }

      return {
        summary,
        topHighlights: [
          `Audience resonance is strongest on top channel (${platforms[0]?.platform || "primary channel"}) with ${platforms[0]?.views ?? totals.views ?? 0} views.`,
          `Total direct community responses reached ${totals.comments ?? 0} comments and ${totals.shares ?? 0} shares.`,
        ],
        recommendations: [
          "Double down on content formats that generated peak engagement in the reporting window.",
          "Maintain active comment triage to convert direct feedback into engaged community loyalty.",
        ],
        dataGapsOrCaveats: caveats.length > 0 ? caveats : ["All captured metrics correspond strictly to authentic platform API responses."],
      };
    }

    // Default: Caption generation
    const campaign = (data.campaign ?? {}) as Record<string, unknown>;
    const brand = (data.brand ?? {}) as Record<string, unknown>;
    const topic = typeof data.title === "string" ? data.title : "this";
    const audience =
      (campaign.targetAudience as string | undefined) ??
      (brand.audience as string | undefined) ??
      (data.targetAudience as string | undefined) ??
      (data.audience as string | undefined) ??
      "your audience";
    const cta = (campaign.cta as string | undefined) ?? (data.cta as string | undefined) ?? "Check it out";
    const tone = (campaign.tone as string | undefined) ?? (data.tone as string | undefined) ?? "friendly";
    const disclosure = typeof data.disclosureText === "string" ? data.disclosureText : "";

    const caption = `${platform} angle on “${topic}” for ${audience} — ${tone} tone. ${cta}.`.trim();
    return {
      hook: `${platform}: ${topic}`,
      caption: disclosure ? `${caption} ${disclosure}` : caption,
      hashtags: ["#buildinpublic", `#${platform.toLowerCase()}`],
      cta,
    };
  }
}

/** Pull the JSON object the generation service embeds after "DATA:". */
function extractDataBlock(user: string): Record<string, unknown> | null {
  const idx = user.indexOf("DATA:");
  if (idx === -1) return null;
  const slice = user.slice(idx + 5);
  const start = slice.indexOf("{");
  const end = slice.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(slice.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Guard against accidental network use in tests (docs/05: no live calls in CI). */
export function assertNoLiveProvider(provider: LLMProvider) {
  if (provider.id === "anthropic" || provider.id === "openai") {
    throw new LLMError(provider.id, "Live provider used in test run — use MockLLMProvider.");
  }
}

import { MockLLMProvider } from "./mock-provider";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenAIProvider } from "./openai-provider";
import { GeminiProvider } from "./gemini-provider";
import type { LLMProvider } from "./port";

export interface ProviderSelection {
  provider: LLMProvider;
  /** True when no API key is configured and the deterministic mock is in use. */
  isMock: boolean;
}

/**
 * Provider selection (docs/05 §3): AI_PROVIDER picks the adapter; when its API
 * key is missing we fall back to the deterministic mock so the product remains
 * fully runnable (generation quality simply degrades instead of erroring).
 */
export type LLMEnv = Partial<
  Record<
    "AI_PROVIDER" | "ANTHROPIC_API_KEY" | "OPENAI_API_KEY" | "GEMINI_API_KEY" | "AI_MODEL",
    string
  >
>;

export function selectLLMProvider(env: LLMEnv = process.env as LLMEnv): ProviderSelection {
  const requested = (env.AI_PROVIDER ?? "anthropic").toLowerCase();

  if (requested === "gemini") {
    const key = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (key) {
      return { provider: new GeminiProvider({ apiKey: key, model: env.AI_MODEL }), isMock: false };
    }
    return { provider: new MockLLMProvider(), isMock: true };
  }

  if (requested === "openai") {
    if (env.OPENAI_API_KEY) {
      return { provider: new OpenAIProvider({ apiKey: env.OPENAI_API_KEY, model: env.AI_MODEL }), isMock: false };
    }
    return { provider: new MockLLMProvider(), isMock: true };
  }

  if (requested === "anthropic") {
    if (env.ANTHROPIC_API_KEY) {
      return { provider: new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.AI_MODEL }), isMock: false };
    }
    return { provider: new MockLLMProvider(), isMock: true };
  }

  return { provider: new MockLLMProvider(), isMock: true };
}

import { describe, it, expect } from "vitest";
import { GeminiProvider } from "../src/gemini-provider";
import { selectLLMProvider } from "../src/factory";

describe("Gemini Provider Integration", () => {
  it("should select GeminiProvider when AI_PROVIDER is gemini", () => {
    const { provider, isMock } = selectLLMProvider({
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "test-gemini-key",
      AI_MODEL: "gemini-flash-latest",
    });

    expect(provider.id).toBe("gemini");
    expect(isMock).toBe(false);
    expect(provider.model).toBe("gemini-flash-latest");
  });

  const apiKey = process.env.GEMINI_API_KEY;
  const itLive = apiKey ? it : it.skip;

  itLive("should make live completion call with Gemini API key", async () => {
    const provider = new GeminiProvider({
      apiKey: apiKey!,
      model: "gemini-3.5-flash",
    });

    const res = await provider.complete({
      system: "You are an AI assistant.",
      user: "Reply with the word 'VERIFIED'.",
      maxTokens: 50,
    });

    expect(res.raw).toBeDefined();
    expect(res.raw.toUpperCase()).toContain("VERIFIED");
  }, 20000);
});


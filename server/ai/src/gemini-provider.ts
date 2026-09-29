import { LLMError, parseJsonOutput } from "./port";
import type { CompleteRequest, CompleteResponse, LLMProvider } from "./port";

const DEFAULT_MODEL = "gemini-3.5-flash";
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
];

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini";
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GeminiOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    this.model = opts.model ?? process.env.AI_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    if (!this.apiKey) {
      throw new LLMError(this.id, "GEMINI_API_KEY is not set.");
    }
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const jsonInstruction = req.outputSchema
      ? "\n\nRespond with ONLY a single valid JSON object (no markdown formatting, no code fences) matching the requested shape."
      : "";

    const systemPrompt = req.system ? `${req.system}\n\n` : "";
    const promptText = `${systemPrompt}${req.user}${jsonInstruction}`;

    const modelsToTry = [this.model, ...FALLBACK_MODELS.filter((m) => m !== this.model)];
    let lastError: Error | null = null;

    for (const modelCandidate of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${this.apiKey}`;

      try {
        const res = await this.fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: req.temperature ?? 0.7,
              maxOutputTokens: req.maxTokens ?? 1500,
              ...(req.outputSchema ? { responseMimeType: "application/json" } : {}),
            },
          }),
        });

        if (res.status === 503 || res.status === 404 || res.status === 429) {
          // Model busy, rate limited, or deprecated; continue to next fallback
          continue;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          lastError = new Error(`Gemini API returned HTTP ${res.status}: ${errText}`);
          continue;
        }

        const json = (await res.json()) as any;
        const parts = json?.candidates?.[0]?.content?.parts || [];
        const rawText = parts.map((p: any) => p.text || "").filter(Boolean).join("\n").trim();

        if (!rawText) {
          continue;
        }

        const usage = json?.usageMetadata
          ? {
              inputTokens: json.usageMetadata.promptTokenCount ?? 0,
              outputTokens: json.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: json.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined;

        const output = req.outputSchema ? parseJsonOutput(rawText, req.outputSchema) : rawText;
        return {
          output,
          raw: rawText,
          model: modelCandidate,
          provider: this.id,
          usage,
        };
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    throw new LLMError(this.id, `All Gemini models failed or were unavailable.`, { cause: lastError });
  }
}

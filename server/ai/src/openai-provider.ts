import { LLMError, parseJsonOutput } from "./port";
import type { CompleteRequest, CompleteResponse, LLMProvider } from "./port";

/**
 * OpenAI adapter (docs/04 §4) — Chat Completions over fetch, JSON mode when an
 * output schema is present. No SDK dependency.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export interface OpenAIOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OpenAIOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = opts.model ?? process.env.AI_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    if (!this.apiKey) {
      throw new LLMError(this.id, "OPENAI_API_KEY is not set.");
    }
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const jsonInstruction = req.outputSchema
      ? "\n\nRespond with ONLY a single JSON object (no prose, no code fences) matching the requested shape."
      : "";

    let body: string;
    try {
      body = JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.7,
        ...(req.outputSchema ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: req.system + jsonInstruction },
          { role: "user", content: req.user },
        ],
      });
    } catch (e) {
      throw new LLMError(this.id, "Failed to serialize request.", { cause: e });
    }

    let res: Response;
    try {
      res = await this.fetchImpl(OPENAI_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body,
      });
    } catch (e) {
      throw new LLMError(this.id, "Could not reach the OpenAI API.", { retryable: true, cause: e });
    }

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      const text = await res.text().catch(() => "");
      throw new LLMError(this.id, `OpenAI API error ${res.status}: ${text.slice(0, 300)}`, {
        status: res.status,
        retryable,
      });
    }

    type ChatResponse = {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const data = (await res.json().catch(() => null)) as ChatResponse | null;
    const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      throw new LLMError(this.id, "OpenAI returned an empty response.");
    }

    return {
      output: req.outputSchema ? parseJsonOutput(raw, req.outputSchema) : raw,
      raw,
      model: this.model,
      provider: this.id,
      usage: {
        inputTokens: data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.completion_tokens,
      },
    };
  }
}

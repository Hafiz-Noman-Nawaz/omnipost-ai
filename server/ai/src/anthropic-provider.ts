import { envSchemaForTests } from "@omnipost/shared";
import { LLMError, parseJsonOutput } from "./port";
import type { CompleteRequest, CompleteResponse, LLMProvider } from "./port";

/**
 * Anthropic adapter (docs/04 §4). Uses the Messages API over fetch — no SDK —
 * so the package stays dependency-light. Model output is requested as JSON and
 * parsed/validated through the shared helper.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export interface AnthropicOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AnthropicOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = opts.model ?? process.env.AI_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    if (!this.apiKey) {
      throw new LLMError(this.id, "ANTHROPIC_API_KEY is not set.");
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
        system: req.system + jsonInstruction,
        messages: [{ role: "user", content: req.user }],
      });
    } catch (e) {
      throw new LLMError(this.id, "Failed to serialize request.", { cause: e });
    }

    let res: Response;
    try {
      res = await this.fetchImpl(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body,
      });
    } catch (e) {
      throw new LLMError(this.id, "Could not reach the Anthropic API.", { retryable: true, cause: e });
    }

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      const text = await res.text().catch(() => "");
      throw new LLMError(this.id, `Anthropic API error ${res.status}: ${text.slice(0, 300)}`, {
        status: res.status,
        retryable,
      });
    }

    type MessagesResponse = {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const data = (await res.json().catch(() => null)) as MessagesResponse | null;
    const raw = (data?.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();
    if (!raw) {
      throw new LLMError(this.id, "Anthropic returned an empty response.");
    }

    return {
      output: req.outputSchema ? parseJsonOutput(raw, req.outputSchema) : raw,
      raw,
      model: this.model,
      provider: this.id,
      usage: {
        inputTokens: data?.usage?.input_tokens,
        outputTokens: data?.usage?.output_tokens,
      },
    };
  }
}

/** Validate that provider env vars parse under the shared contract (docs/05 §3). */
export function anthropicEnvOk(): boolean {
  const parsed = envSchemaForTests.safeParse(process.env);
  return parsed.success && !!parsed.data.ANTHROPIC_API_KEY;
}

/**
 * LLM abstraction (docs/04 §4). The rest of the system depends only on this
 * port; adapters (anthropic, openai, mock) are selected by env/factory.
 */

import type { z } from "zod";

export interface CompleteRequest {
  /** Fully assembled prompt (system + instructions + delimited data). */
  system: string;
  user: string;
  /** Soft output contract; adapters ask the model for JSON conforming to it. */
  outputSchema?: z.ZodType;
  maxTokens?: number;
  temperature?: number;
}

export interface CompleteResponse {
  /** Parsed JSON when outputSchema was given; raw text otherwise. */
  output: unknown;
  raw: string;
  model: string;
  provider: string;
  /** Input+output tokens as reported by the provider (mocks estimate). */
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * Minimal port for Phase 4 (caption/variation generation). The full agent
 * toolLoop (docs/04 §1) arrives with Phase 12; the port is shaped so
 * `toolLoop` can be added without breaking implementers.
 */
export interface LLMProvider {
  readonly id: string;
  readonly model: string;
  complete(req: CompleteRequest): Promise<CompleteResponse>;
}

export class LLMError extends Error {
  readonly provider: string;
  readonly status?: number;
  readonly retryable: boolean;
  constructor(provider: string, message: string, opts: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = "LLMError";
    this.provider = provider;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

/** Shared helper: parse model JSON out of a response, tolerating code fences. */
export function parseJsonOutput<T>(raw: string, schema?: z.ZodType<T>): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Some models prepend prose; take the outermost JSON object/array.
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model response is not valid JSON.");
    }
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new Error("Model response is not valid JSON.");
    }
  }
  if (!schema) return parsed as T;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model output failed schema validation: ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
}

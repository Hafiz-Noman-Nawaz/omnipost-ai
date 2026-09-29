export * from "./port";
export * from "./mock-provider";
export * from "./anthropic-provider";
export * from "./openai-provider";
export * from "./gemini-provider";
export * from "./factory";
export * from "./prompts";
export * from "./guardrails";
export * from "./agent/types";
export * from "./agent/permissionGate";
export * from "./agent/tools";
export * from "./agent/runner";
export * from "./multimodal";
export * from "./agent/brandMemory";
export * from "./abTesting";
export * from "./trends";

import type { LLMProvider } from "./port";
import {
  getPrompt,
  COMMENT_CLASSIFIER_SCHEMA,
  type CommentClassifierInput,
  type CommentClassifierOutput,
  REPLY_SUGGESTER_SCHEMA,
  type ReplySuggesterInput,
  type ReplySuggesterOutput,
  ANALYTICS_SUMMARIZER_SCHEMA,
  type AnalyticsSummarizerInput,
  type AnalyticsSummarizerOutput,
} from "./prompts";

export async function classifyComment(
  llm: LLMProvider,
  input: CommentClassifierInput
): Promise<CommentClassifierOutput> {
  const prompt = getPrompt("comment_classifier");
  const res = await llm.complete({
    system: prompt.system,
    user: prompt.buildUser(input),
    outputSchema: COMMENT_CLASSIFIER_SCHEMA,
    temperature: 0.1,
  });
  return res.output as CommentClassifierOutput;
}

export async function generateReplySuggestions(
  llm: LLMProvider,
  input: ReplySuggesterInput
): Promise<ReplySuggesterOutput> {
  const prompt = getPrompt("reply_suggester");
  const res = await llm.complete({
    system: prompt.system,
    user: prompt.buildUser(input),
    outputSchema: REPLY_SUGGESTER_SCHEMA,
    temperature: 0.6,
  });
  return res.output as ReplySuggesterOutput;
}

export async function summarizeAnalytics(
  llm: LLMProvider,
  input: AnalyticsSummarizerInput
): Promise<AnalyticsSummarizerOutput> {
  const prompt = getPrompt("analytics_summarizer");
  const res = await llm.complete({
    system: prompt.system,
    user: prompt.buildUser(input),
    outputSchema: ANALYTICS_SUMMARIZER_SCHEMA,
    temperature: 0.2,
  });
  return res.output as AnalyticsSummarizerOutput;
}


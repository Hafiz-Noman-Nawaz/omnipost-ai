import { z } from "zod";

export type ToolRiskClass = "READ" | "WRITE" | "HIGH_RISK";
export type AgentRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export const ROLE_HIERARCHY: Record<AgentRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export interface AgentExecutionContext {
  organizationId: string;
  userId?: string | null;
  userRole: AgentRole;
  executionId: string;
  confirmedToolCallId?: string | null;
}

export interface AgentToolDefinition<TArgs = any, TResult = any> {
  name: string;
  description: string;
  riskClass: ToolRiskClass;
  minRole: AgentRole;
  parameters: z.ZodType<TArgs>;
  execute(args: TArgs, ctx: AgentExecutionContext): Promise<TResult>;
}

export interface AgentToolCallItem {
  id: string;
  toolName: string;
  args: any;
  riskClass: ToolRiskClass;
  allowed: boolean;
  denialReason?: string | null;
  pendingConfirmation?: boolean;
  result?: any;
  resultSummary?: string | null;
}

export interface AgentRunInput {
  organizationId: string;
  userId?: string | null;
  userRole: AgentRole;
  userMessage: string;
  trigger?: "CHAT" | "DAILY_REPORT" | "WORKER" | "AUTONOMOUS_PLANNING";
  confirmedToolCallId?: string | null;
}

export interface AgentRunResult {
  executionId: string;
  status: "completed" | "pending_confirmation" | "failed";
  finalResponse: string;
  toolCalls: AgentToolCallItem[];
  promptInjectionFlags: string[];
  pendingConfirmationToken?: string | null;
}

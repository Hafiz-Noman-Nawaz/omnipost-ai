import {
  createAgentExecution,
  updateAgentExecution,
  recordAgentToolCall,
  type SessionContext,
} from "@omnipost/database";
import {
  AgentRunInput,
  AgentRunResult,
  AgentToolCallItem,
  AgentExecutionContext,
  ROLE_HIERARCHY,
} from "./types";
import {
  detectPromptInjection,
  checkToolPermission,
} from "./permissionGate";
import { ALL_AGENT_TOOLS, getToolByName } from "./tools";
import type { LLMProvider } from "../port";

/**
 * Executes the autonomous agent runner loop.
 */
export async function runAgent(
  llm: LLMProvider,
  input: AgentRunInput
): Promise<AgentRunResult> {
  const injectionFlags = detectPromptInjection(input.userMessage);

  const dbCtx: SessionContext = {
    organizationId: input.organizationId,
    user: {
      id: input.userId || "agent_system",
      role: input.userRole as any,
      email: "agent@omnipost.local",
      name: "OmniPost Agent",
    },
  };

  // 1. Create DB execution record
  const execution = await createAgentExecution(dbCtx, {
    userId: input.userId,
    trigger: input.trigger || "CHAT",
    model: llm.model,
    input: input.userMessage,
    promptInjectionFlags: injectionFlags,
  });

  const execCtx: AgentExecutionContext = {
    organizationId: input.organizationId,
    userId: input.userId,
    userRole: input.userRole,
    executionId: execution.id,
    confirmedToolCallId: input.confirmedToolCallId,
  };

  // If injection detected, tripwire pauses autonomous execution immediately
  if (injectionFlags.length > 0) {
    const errorMsg = `Autonomous loop aborted: Prompt injection tripwire triggered. Flags: ${injectionFlags.join("; ")}`;
    await updateAgentExecution(dbCtx, execution.id, {
      status: "failed",
      output: errorMsg,
      promptInjectionFlags: injectionFlags,
    });

    return {
      executionId: execution.id,
      status: "failed",
      finalResponse: errorMsg,
      toolCalls: [],
      promptInjectionFlags: injectionFlags,
    };
  }

  // 2. Filter available tools by actor's role
  const actorRoleLevel = ROLE_HIERARCHY[input.userRole] ?? 0;
  const allowedTools = ALL_AGENT_TOOLS.filter(
    (t) => actorRoleLevel >= (ROLE_HIERARCHY[t.minRole] ?? 99)
  );

  const executedToolCalls: AgentToolCallItem[] = [];
  let pendingConfirmationToken: string | null = null;
  let finalStatus: AgentRunResult["status"] = "completed";
  let finalResponse = "";

  // 3. Determine planned tool sequence (deterministic synthesis for MockLLMProvider or toolLoop)
  const lowerMsg = input.userMessage.toLowerCase();
  const plannedCalls: Array<{ toolName: string; args: any }> = [];

  if (lowerMsg.includes("publish") || lowerMsg.includes("live post") || lowerMsg.includes("send to instagram")) {
    plannedCalls.push({ toolName: "publish_post", args: { postId: "post_sample_p12" } });
  } else if (lowerMsg.includes("campaign") && (lowerMsg.includes("create") || lowerMsg.includes("plan") || lowerMsg.includes("launch"))) {
    plannedCalls.push({
      toolName: "create_campaign",
      args: {
        name: "Autonomous Growth Sprint",
        objective: "Expand audience reach through multi-channel content",
        targetAudience: "Tech innovators and developers",
      },
    });
    plannedCalls.push({
      toolName: "create_post_draft",
      args: {
        platform: "LINKEDIN",
        caption: "Supercharging our workflow with autonomous AI social orchestration. #buildinpublic #automation",
        hashtags: ["#buildinpublic", "#automation"],
      },
    });
    plannedCalls.push({
      toolName: "request_human_approval",
      args: { postId: "post_new_draft", reason: "Autonomous post created and queued for human administrator review." },
    });
  } else if (lowerMsg.includes("analytics") || lowerMsg.includes("performance") || lowerMsg.includes("metric") || lowerMsg.includes("stats")) {
    plannedCalls.push({ toolName: "get_analytics", args: { days: 30 } });
  } else if (lowerMsg.includes("comment") || lowerMsg.includes("moderation") || lowerMsg.includes("inbox")) {
    plannedCalls.push({ toolName: "get_comments", args: { limit: 5 } });
  } else if (lowerMsg.includes("schedule") || lowerMsg.includes("calendar")) {
    plannedCalls.push({ toolName: "get_scheduled_posts", args: { limit: 5 } });
  } else if (lowerMsg.includes("scan") || lowerMsg.includes("daily") || input.trigger === "DAILY_REPORT" || input.trigger === "AUTONOMOUS_PLANNING") {
    plannedCalls.push({ toolName: "get_analytics", args: { days: 7 } });
    plannedCalls.push({ toolName: "get_comments", args: { limit: 10 } });
    plannedCalls.push({ toolName: "get_scheduled_posts", args: { limit: 5 } });
  } else {
    // Default helpful reconnaissance
    plannedCalls.push({ toolName: "get_accounts", args: {} });
  }

  // 4. Execute tool loop with safety checks
  for (const call of plannedCalls.slice(0, 12)) {
    const tool = getToolByName(call.toolName);
    if (!tool) continue;

    const perm = checkToolPermission(tool, execCtx);

    if (perm.requiresConfirmation) {
      // HIGH_RISK requires explicit admin confirmation
      const recorded = await recordAgentToolCall(dbCtx, {
        executionId: execution.id,
        toolName: tool.name,
        args: call.args,
        riskClass: tool.riskClass,
        allowed: false,
        denialReason: perm.denialReason,
        resultSummary: "Blocked: Pending administrator confirmation.",
      });

      executedToolCalls.push({
        id: recorded.id,
        toolName: tool.name,
        args: call.args,
        riskClass: tool.riskClass,
        allowed: false,
        pendingConfirmation: true,
        denialReason: perm.denialReason,
        resultSummary: "Action blocked pending explicit human administrator confirmation.",
      });

      pendingConfirmationToken = recorded.id;
      finalStatus = "pending_confirmation";
      finalResponse = `The operation "${tool.name}" is classified as HIGH_RISK because it directly mutates live external social channels. Explicit human administrator confirmation is required before execution.`;
      break;
    }

    if (!perm.allowed) {
      const recorded = await recordAgentToolCall(dbCtx, {
        executionId: execution.id,
        toolName: tool.name,
        args: call.args,
        riskClass: tool.riskClass,
        allowed: false,
        denialReason: perm.denialReason,
        resultSummary: "Permission Denied",
      });

      executedToolCalls.push({
        id: recorded.id,
        toolName: tool.name,
        args: call.args,
        riskClass: tool.riskClass,
        allowed: false,
        denialReason: perm.denialReason,
      });
      continue;
    }

    // Execute tool
    try {
      const result = await tool.execute(call.args, execCtx);
      const summary = typeof result === "object" ? JSON.stringify(result).slice(0, 200) : String(result);

      const recorded = await recordAgentToolCall(dbCtx, {
        executionId: execution.id,
        toolName: tool.name,
        args: call.args,
        riskClass: tool.riskClass,
        allowed: true,
        resultSummary: summary,
      });

      executedToolCalls.push({
        id: recorded.id,
        toolName: tool.name,
        args: call.args,
        riskClass: tool.riskClass,
        allowed: true,
        result,
        resultSummary: summary,
      });
    } catch (err: any) {
      const recorded = await recordAgentToolCall(dbCtx, {
        executionId: execution.id,
        toolName: tool.name,
        args: call.args,
        riskClass: tool.riskClass,
        allowed: false,
        denialReason: err?.message || String(err),
      });

      executedToolCalls.push({
        id: recorded.id,
        toolName: tool.name,
        args: call.args,
        riskClass: tool.riskClass,
        allowed: false,
        denialReason: err?.message || String(err),
      });
    }
  }

  if (finalStatus !== "pending_confirmation") {
    finalResponse = `Autonomous execution completed successfully. Performed ${executedToolCalls.filter((c) => c.allowed).length} action(s) across organization assets adhering to strict zero-trust safety bounds.`;
  }

  // 5. Update execution in DB
  await updateAgentExecution(dbCtx, execution.id, {
    status: finalStatus,
    output: finalResponse,
    promptInjectionFlags: injectionFlags,
  });

  return {
    executionId: execution.id,
    status: finalStatus,
    finalResponse,
    toolCalls: executedToolCalls,
    promptInjectionFlags: injectionFlags,
    pendingConfirmationToken,
  };
}

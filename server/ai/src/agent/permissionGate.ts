import {
  AgentRole,
  AgentToolDefinition,
  AgentExecutionContext,
  ROLE_HIERARCHY,
  ToolRiskClass,
} from "./types";

export interface PermissionCheckResult {
  allowed: boolean;
  denialReason?: string;
  requiresConfirmation?: boolean;
}

export const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /reveal\s+(the\s+)?system\s+prompt/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /jailbreak/i,
  /override\s+safety\s+guidelines/i,
  /bypass\s+permissions/i,
];

/**
 * Scan input text for adversarial prompt injection attempts.
 */
export function detectPromptInjection(text: string): string[] {
  const flags: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(`TRIPWIRE: Pattern match "${pattern.source}"`);
    }
  }
  return flags;
}

/**
 * Safely format external content (comments, fetched pages) as delimited data.
 */
export function wrapExternalContent(content: string, label = "external_content"): string {
  const clean = content.replace(/<\/?external_content>/gi, "");
  return `<${label}>\n${clean}\n</${label}>`;
}

/**
 * Validate whether the actor is allowed to execute the requested tool.
 */
export function checkToolPermission(
  tool: AgentToolDefinition,
  ctx: AgentExecutionContext
): PermissionCheckResult {
  const actorLevel = ROLE_HIERARCHY[ctx.userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[tool.minRole] ?? 99;

  // 1. RBAC check
  if (actorLevel < requiredLevel) {
    return {
      allowed: false,
      denialReason: `Permission denied: Tool "${tool.name}" requires role ${tool.minRole}, but user role is ${ctx.userRole}.`,
    };
  }

  // 2. Risk check: HIGH_RISK tools require explicit confirmation token unless previously confirmed
  if (tool.riskClass === "HIGH_RISK") {
    if (!ctx.confirmedToolCallId) {
      return {
        allowed: false,
        requiresConfirmation: true,
        denialReason: `Confirmation required: Tool "${tool.name}" is classified as HIGH_RISK and requires administrator approval.`,
      };
    }
  }

  return { allowed: true };
}

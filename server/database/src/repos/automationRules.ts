import { prisma } from "../client";
import { AppError } from "@omnipost/shared";
import { writeAudit } from "./audit";
import type { SessionContext } from "./session-context";
import {
  CommentIntent,
  AutomationAction,
} from "../generated/prisma/enums";

export interface CreateRuleInput {
  name: string;
  campaignId?: string | null;
  priority?: number;
  matchIntent?: CommentIntent | string | null;
  matchSentiment?: string | null;
  action: AutomationAction | string;
  templateId?: string | null;
  requireApproval?: boolean;
  enabled?: boolean;
}

export interface UpdateRuleInput {
  name?: string;
  campaignId?: string | null;
  priority?: number;
  matchIntent?: CommentIntent | string | null;
  matchSentiment?: string | null;
  action?: AutomationAction | string;
  templateId?: string | null;
  requireApproval?: boolean;
  enabled?: boolean;
}

export interface ListRulesFilter {
  campaignId?: string;
  enabled?: boolean;
  action?: AutomationAction | string;
}

function getOrgId(ctx: SessionContext): string {
  return (
    ctx.organizationId ??
    (ctx as unknown as { organization?: { id: string } }).organization?.id
  );
}

export async function listAutomationRules(
  ctx: SessionContext,
  filter: ListRulesFilter = {}
) {
  const orgId = getOrgId(ctx);
  const where: Record<string, unknown> = { organizationId: orgId };

  if (filter.campaignId) {
    where.campaignId = filter.campaignId;
  }
  if (filter.enabled !== undefined) {
    where.enabled = filter.enabled;
  }
  if (filter.action) {
    where.action = filter.action as AutomationAction;
  }

  const rules = await prisma.automationRule.findMany({
    where,
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    include: {
      campaign: {
        select: { id: true, name: true },
      },
    },
  });

  // Fetch associated response templates if present
  const templateIds = rules
    .map((r) => r.templateId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const templates = templateIds.length > 0
    ? await prisma.responseTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true, body: true, intent: true },
      })
    : [];

  const templateMap = new Map(templates.map((t) => [t.id, t]));

  return rules.map((rule) => ({
    ...rule,
    template: rule.templateId ? templateMap.get(rule.templateId) ?? null : null,
  }));
}

export async function getAutomationRuleById(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const rule = await prisma.automationRule.findFirst({
    where: { id, organizationId: orgId },
    include: {
      campaign: { select: { id: true, name: true } },
    },
  });

  if (!rule) {
    throw new AppError("NOT_FOUND", `Automation rule not found: ${id}`);
  }

  let template = null;
  if (rule.templateId) {
    template = await prisma.responseTemplate.findFirst({
      where: { id: rule.templateId },
      select: { id: true, name: true, body: true, intent: true },
    });
  }

  return { ...rule, template };
}

export async function createAutomationRule(
  ctx: SessionContext,
  input: CreateRuleInput
) {
  const orgId = getOrgId(ctx);

  if (!input.name || !input.name.trim()) {
    throw new AppError("VALIDATION_ERROR", "Rule name is required");
  }

  if (input.action === AutomationAction.AUTO_REPLY && !input.templateId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "templateId is required when action is AUTO_REPLY"
    );
  }

  if (input.templateId) {
    const tpl = await prisma.responseTemplate.findFirst({
      where: { id: input.templateId, organizationId: orgId },
    });
    if (!tpl) {
      throw new AppError(
        "NOT_FOUND",
        `Response template ${input.templateId} not found`
      );
    }
  }

  // Determine next priority if not specified
  let priority = input.priority ?? 100;
  if (input.priority === undefined) {
    const highest = await prisma.automationRule.findFirst({
      where: { organizationId: orgId },
      orderBy: { priority: "desc" },
    });
    priority = (highest?.priority ?? 0) + 10;
  }

  const rule = await prisma.automationRule.create({
    data: {
      organizationId: orgId,
      name: input.name.trim(),
      campaignId: input.campaignId ?? null,
      priority,
      matchIntent: input.matchIntent
        ? (input.matchIntent as CommentIntent)
        : null,
      matchSentiment: input.matchSentiment ?? null,
      action: input.action as AutomationAction,
      templateId: input.templateId ?? null,
      requireApproval: input.requireApproval ?? false,
      enabled: input.enabled ?? true,
    },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "AUTOMATION_RULE_CREATE",
    resourceType: "AUTOMATION_RULE",
    resourceId: rule.id,
    metadata: { name: rule.name, action: rule.action, priority: rule.priority },
  });

  return rule;
}

export async function updateAutomationRule(
  ctx: SessionContext,
  id: string,
  input: UpdateRuleInput
) {
  const orgId = getOrgId(ctx);
  const existing = await getAutomationRuleById(ctx, id);

  if (input.templateId) {
    const tpl = await prisma.responseTemplate.findFirst({
      where: { id: input.templateId, organizationId: orgId },
    });
    if (!tpl) {
      throw new AppError(
        "NOT_FOUND",
        `Response template ${input.templateId} not found`
      );
    }
  }

  const updated = await prisma.automationRule.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.matchIntent !== undefined
        ? {
            matchIntent: input.matchIntent
              ? (input.matchIntent as CommentIntent)
              : null,
          }
        : {}),
      ...(input.matchSentiment !== undefined
        ? { matchSentiment: input.matchSentiment }
        : {}),
      ...(input.action !== undefined
        ? { action: input.action as AutomationAction }
        : {}),
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
      ...(input.requireApproval !== undefined
        ? { requireApproval: input.requireApproval }
        : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "AUTOMATION_RULE_UPDATE",
    resourceType: "AUTOMATION_RULE",
    resourceId: updated.id,
    metadata: { changes: Object.keys(input) },
  });

  return updated;
}

export async function deleteAutomationRule(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const existing = await getAutomationRuleById(ctx, id);

  await prisma.automationRule.delete({
    where: { id: existing.id },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "AUTOMATION_RULE_DELETE",
    resourceType: "AUTOMATION_RULE",
    resourceId: id,
    metadata: { name: existing.name },
  });

  return { success: true, id };
}

export async function reorderAutomationRules(
  ctx: SessionContext,
  ruleIds: string[]
) {
  const orgId = getOrgId(ctx);

  await prisma.$transaction(
    ruleIds.map((id, index) =>
      prisma.automationRule.updateMany({
        where: { id, organizationId: orgId },
        data: { priority: (index + 1) * 10 },
      })
    )
  );

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "AUTOMATION_RULES_REORDER",
    resourceType: "AUTOMATION_RULE",
    resourceId: "batch",
    metadata: { ruleIds },
  });

  return listAutomationRules(ctx);
}

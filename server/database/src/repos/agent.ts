import { prisma } from "../client";
import { AppError } from "@omnipost/shared";
import type { SessionContext } from "./session-context";
import { ToolRiskClass } from "../generated/prisma/enums";

function getOrgId(ctx: SessionContext): string {
  const id =
    ctx.organizationId ??
    (ctx as unknown as { organization?: { id: string } }).organization?.id;
  if (!id) {
    throw new AppError("UNAUTHENTICATED", "Missing organization context for agent operation");
  }
  return id;
}

export interface CreateAgentExecutionInput {
  userId?: string | null;
  trigger: "CHAT" | "DAILY_REPORT" | "WORKER" | "AUTONOMOUS_PLANNING";
  model?: string | null;
  input: string;
  promptInjectionFlags?: string[];
}

export interface RecordToolCallInput {
  executionId: string;
  toolName: string;
  args: any;
  riskClass: ToolRiskClass | "READ" | "WRITE" | "HIGH_RISK";
  allowed: boolean;
  denialReason?: string | null;
  resultSummary?: string | null;
}

export async function createAgentExecution(
  ctx: SessionContext,
  input: CreateAgentExecutionInput
) {
  const orgId = getOrgId(ctx);

  return prisma.agentExecution.create({
    data: {
      organizationId: orgId,
      userId: input.userId ?? ctx.user?.id ?? null,
      trigger: input.trigger,
      model: input.model ?? "omnipost-agent-v1",
      input: input.input,
      status: "running",
      promptInjectionFlags: input.promptInjectionFlags ?? [],
    },
  });
}

export async function updateAgentExecution(
  ctx: SessionContext,
  executionId: string,
  update: {
    output?: string | null;
    status?: "completed" | "pending_confirmation" | "failed" | "cancelled";
    promptInjectionFlags?: string[];
    finishedAt?: Date | null;
  }
) {
  const orgId = getOrgId(ctx);

  const exec = await prisma.agentExecution.findFirst({
    where: { id: executionId, organizationId: orgId },
  });

  if (!exec) {
    throw new AppError("NOT_FOUND", `Agent execution ${executionId} not found`);
  }

  return prisma.agentExecution.update({
    where: { id: executionId },
    data: {
      output: update.output !== undefined ? update.output : undefined,
      status: update.status !== undefined ? update.status : undefined,
      promptInjectionFlags: update.promptInjectionFlags !== undefined ? update.promptInjectionFlags : undefined,
      finishedAt: update.finishedAt !== undefined ? update.finishedAt : (update.status ? new Date() : undefined),
    },
  });
}

export async function recordAgentToolCall(
  ctx: SessionContext,
  input: RecordToolCallInput
) {
  const orgId = getOrgId(ctx);

  const exec = await prisma.agentExecution.findFirst({
    where: { id: input.executionId, organizationId: orgId },
  });

  if (!exec) {
    throw new AppError("NOT_FOUND", `Agent execution ${input.executionId} not found`);
  }

  return prisma.agentToolCall.create({
    data: {
      executionId: input.executionId,
      toolName: input.toolName,
      args: input.args,
      riskClass: input.riskClass as ToolRiskClass,
      allowed: input.allowed,
      denialReason: input.denialReason ?? null,
      resultSummary: input.resultSummary ?? null,
    },
  });
}

export async function confirmAgentToolCall(
  ctx: SessionContext,
  toolCallId: string,
  action: "APPROVE" | "REJECT"
) {
  const orgId = getOrgId(ctx);

  const toolCall = await prisma.agentToolCall.findFirst({
    where: { id: toolCallId },
    include: { execution: true },
  });

  if (!toolCall || toolCall.execution.organizationId !== orgId) {
    throw new AppError("NOT_FOUND", `Tool call ${toolCallId} not found`);
  }

  if (toolCall.allowed && action === "APPROVE") {
    return { toolCall, status: "ALREADY_APPROVED" };
  }

  const updated = await prisma.agentToolCall.update({
    where: { id: toolCallId },
    data: {
      allowed: action === "APPROVE",
      denialReason: action === "REJECT" ? "Rejected by human administrator confirmation" : null,
      resultSummary: action === "APPROVE" ? "Approved by administrator for execution" : "Rejected by administrator",
    },
  });

  if (action === "APPROVE") {
    await prisma.agentExecution.update({
      where: { id: toolCall.executionId },
      data: { status: "completed", finishedAt: new Date() },
    });
  } else {
    await prisma.agentExecution.update({
      where: { id: toolCall.executionId },
      data: { status: "cancelled", finishedAt: new Date() },
    });
  }

  return { toolCall: updated, status: action };
}

export async function listAgentExecutions(
  ctx: SessionContext,
  filter?: { limit?: number; offset?: number; status?: string }
) {
  const orgId = getOrgId(ctx);
  const limit = Math.min(filter?.limit ?? 50, 100);
  const offset = filter?.offset ?? 0;

  const where: any = { organizationId: orgId };
  if (filter?.status) {
    where.status = filter.status;
  }

  const [items, total] = await Promise.all([
    prisma.agentExecution.findMany({
      where,
      include: {
        toolCalls: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.agentExecution.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export async function getAgentExecutionById(
  ctx: SessionContext,
  executionId: string
) {
  const orgId = getOrgId(ctx);

  const exec = await prisma.agentExecution.findFirst({
    where: { id: executionId, organizationId: orgId },
    include: {
      toolCalls: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!exec) {
    throw new AppError("NOT_FOUND", `Agent execution ${executionId} not found`);
  }

  return exec;
}

export async function saveCampaignMemory(
  ctx: SessionContext,
  campaignId: string,
  kind: "insight" | "instruction" | "performance_note",
  content: string
) {
  const orgId = getOrgId(ctx);

  return prisma.campaignMemory.create({
    data: {
      campaignId,
      organizationId: orgId,
      kind,
      content,
    },
  });
}

export async function listCampaignMemories(
  ctx: SessionContext,
  campaignId: string
) {
  const orgId = getOrgId(ctx);

  return prisma.campaignMemory.findMany({
    where: { campaignId, organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
}

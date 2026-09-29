import { prisma } from "../client";
import { AppError, validateTemplateVariables } from "@omnipost/shared";
import { writeAudit } from "./audit";
import type { SessionContext } from "./session-context";
import { CommentIntent } from "../generated/prisma/enums";

export interface CreateTemplateInput {
  name: string;
  intent: CommentIntent | string;
  body: string;
  platforms?: string[];
  active?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  intent?: CommentIntent | string;
  body?: string;
  platforms?: string[];
  active?: boolean;
}

export interface ListTemplatesFilter {
  intent?: CommentIntent | string;
  active?: boolean;
  search?: string;
}

function getOrgId(ctx: SessionContext): string {
  return (
    ctx.organizationId ??
    (ctx as unknown as { organization?: { id: string } }).organization?.id
  );
}

export async function listResponseTemplates(
  ctx: SessionContext,
  filter: ListTemplatesFilter = {}
) {
  const orgId = getOrgId(ctx);
  const where: Record<string, unknown> = { organizationId: orgId };

  if (filter.intent) {
    where.intent = filter.intent as CommentIntent;
  }
  if (filter.active !== undefined) {
    where.active = filter.active;
  }
  if (filter.search && filter.search.trim()) {
    where.OR = [
      { name: { contains: filter.search.trim(), mode: "insensitive" } },
      { body: { contains: filter.search.trim(), mode: "insensitive" } },
    ];
  }

  const items = await prisma.responseTemplate.findMany({
    where,
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });

  return items;
}

export async function getResponseTemplateById(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const template = await prisma.responseTemplate.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!template) {
    throw new AppError("NOT_FOUND", `Response template not found: ${id}`);
  }
  return template;
}

export async function createResponseTemplate(
  ctx: SessionContext,
  input: CreateTemplateInput
) {
  const orgId = getOrgId(ctx);

  if (!input.name || !input.name.trim()) {
    throw new AppError("VALIDATION_ERROR", "Template name is required");
  }
  if (!input.body || !input.body.trim()) {
    throw new AppError("VALIDATION_ERROR", "Template body is required");
  }

  // Validate {{variable}} syntax per spec §18
  const validation = validateTemplateVariables(input.body);
  if (!validation.valid) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid template variables: ${validation.invalidVariables.join(", ")}. Allowed: {{brand}}, {{product}}, {{price}}, {{link}}, {{campaign}}, {{author}}`
    );
  }

  const template = await prisma.responseTemplate.create({
    data: {
      organizationId: orgId,
      name: input.name.trim(),
      intent: input.intent as CommentIntent,
      body: input.body.trim(),
      platforms: input.platforms ?? [],
      active: input.active ?? true,
    },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "RESPONSE_TEMPLATE_CREATE",
    resourceType: "RESPONSE_TEMPLATE",
    resourceId: template.id,
    metadata: { name: template.name, intent: template.intent },
  });

  return template;
}

export async function updateResponseTemplate(
  ctx: SessionContext,
  id: string,
  input: UpdateTemplateInput
) {
  const orgId = getOrgId(ctx);
  await getResponseTemplateById(ctx, id); // Verify ownership

  if (input.body !== undefined) {
    if (!input.body.trim()) {
      throw new AppError("VALIDATION_ERROR", "Template body cannot be empty");
    }
    const validation = validateTemplateVariables(input.body);
    if (!validation.valid) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Invalid template variables: ${validation.invalidVariables.join(", ")}. Allowed: {{brand}}, {{product}}, {{price}}, {{link}}, {{campaign}}, {{author}}`
      );
    }
  }

  const updated = await prisma.responseTemplate.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.intent !== undefined
        ? { intent: input.intent as CommentIntent }
        : {}),
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      ...(input.platforms !== undefined ? { platforms: input.platforms } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "RESPONSE_TEMPLATE_UPDATE",
    resourceType: "RESPONSE_TEMPLATE",
    resourceId: updated.id,
    metadata: { changes: Object.keys(input) },
  });

  return updated;
}

export async function deleteResponseTemplate(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const existing = await getResponseTemplateById(ctx, id);

  await prisma.responseTemplate.delete({
    where: { id: existing.id },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "RESPONSE_TEMPLATE_DELETE",
    resourceType: "RESPONSE_TEMPLATE",
    resourceId: id,
    metadata: { name: existing.name },
  });

  return { success: true, id };
}

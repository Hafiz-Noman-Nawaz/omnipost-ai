import { prisma } from "../client";
import { AppError, interpolateTemplate } from "@omnipost/shared";
import { writeAudit } from "./audit";
import type { SessionContext } from "./session-context";
import {
  CommentStatus,
  CommentIntent,
  AutomationAction,
} from "../generated/prisma/enums";
import { getSettings } from "./settings";
import { hideComment, escalateComment, recordCommentReply } from "./comments";

export interface AutomationResult {
  matchedRule: {
    id: string;
    name: string;
    action: string;
  } | null;
  actionTaken: "AUTO_REPLIED" | "SUGGESTED" | "ESCALATED" | "HIDDEN" | "BLOCKED_BY_KILL_SWITCH" | "NO_MATCH";
  replyText?: string;
  reason?: string;
}

/**
 * Evaluates active automation rules against a classified comment,
 * enforcing the master kill-switch and content safety guardrails (spec §18, §19).
 */
export async function evaluateCommentAutomation(
  ctx: SessionContext,
  commentId: string
): Promise<AutomationResult> {
  const orgId = ctx.organizationId;

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, organizationId: orgId },
    include: {
      post: {
        include: {
          content: {
            include: {
              campaign: true,
            },
          },
        },
      },
      thread: true,
    },
  });

  if (!comment) {
    throw new AppError("NOT_FOUND", `Comment not found: ${commentId}`);
  }

  // If already handled or hidden, skip automation
  if (comment.status === CommentStatus.HANDLED || comment.hidden) {
    return {
      matchedRule: null,
      actionTaken: "NO_MATCH",
      reason: "Comment already handled or hidden",
    };
  }

  const settings = await getSettings(orgId);
  const brand = await prisma.brand.findFirst({
    where: { organizationId: orgId },
  });

  // Strict safety check: Never auto-reply to ABUSE, SPAM, or flagged content
  const hasSafetyFlags =
    Array.isArray(comment.safetyFlags) && comment.safetyFlags.length > 0;
  const isToxic =
    comment.intent === CommentIntent.ABUSE ||
    comment.intent === CommentIntent.SPAM ||
    hasSafetyFlags;

  // Retrieve active rules ordered by priority (lowest integer = highest priority)
  const rules = await prisma.automationRule.findMany({
    where: { organizationId: orgId, enabled: true },
    orderBy: { priority: "asc" },
  });

  // Find first matching rule
  const matchedRule = rules.find((rule) => {
    // Campaign match
    if (rule.campaignId && rule.campaignId !== comment.post?.campaignId) {
      return false;
    }
    // Intent match
    if (rule.matchIntent && rule.matchIntent !== comment.intent) {
      return false;
    }
    // Sentiment match
    if (rule.matchSentiment && rule.matchSentiment !== comment.sentiment) {
      return false;
    }
    return true;
  });

  if (!matchedRule) {
    return {
      matchedRule: null,
      actionTaken: "NO_MATCH",
      reason: "No automation rule matched criteria",
    };
  }

  const ruleSummary = {
    id: matchedRule.id,
    name: matchedRule.name,
    action: matchedRule.action,
  };

  // 1. Action: HIDE
  if (matchedRule.action === AutomationAction.HIDE) {
    await hideComment(ctx, comment.id, "AUTOMATION");
    return {
      matchedRule: ruleSummary,
      actionTaken: "HIDDEN",
      reason: `Hidden by rule "${matchedRule.name}"`,
    };
  }

  // 2. Action: ESCALATE
  if (matchedRule.action === AutomationAction.ESCALATE) {
    await escalateComment(
      ctx,
      comment.id,
      `Escalated by automation rule "${matchedRule.name}"`
    );
    return {
      matchedRule: ruleSummary,
      actionTaken: "ESCALATED",
      reason: `Escalated by rule "${matchedRule.name}"`,
    };
  }

  // 3. Toxic content protection: block any auto-reply attempt
  if (isToxic) {
    await escalateComment(
      ctx,
      comment.id,
      `Auto-reply blocked for toxic/flagged comment. Escalated to human.`
    );
    return {
      matchedRule: ruleSummary,
      actionTaken: "ESCALATED",
      reason: "Auto-reply blocked because comment is flagged as SPAM/ABUSE",
    };
  }

  // Resolve template for reply actions
  let replyText = "";
  if (matchedRule.templateId) {
    const template = await prisma.responseTemplate.findFirst({
      where: { id: matchedRule.templateId, organizationId: orgId },
    });
    if (template) {
      replyText = interpolateTemplate(template.body, {
        brand: brand?.name || "OmniPost",
        product: comment.post?.content?.title || "our product",
        price: "our standard pricing",
        link: comment.post?.linkUrl || comment.post?.content?.campaign?.landingUrl || "https://omnipost.local",
        campaign: comment.post?.content?.campaign?.name || "",
        author: comment.authorName || "there",
      });
    }
  }

  // 4. Action: SUGGEST_REPLY or requireApproval
  if (
    matchedRule.action === AutomationAction.SUGGEST_REPLY ||
    matchedRule.requireApproval
  ) {
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: CommentStatus.ACTION_PENDING },
    });

    await writeAudit(orgId, {
      actorType: "SYSTEM",
      action: "AUTOMATION_SUGGEST_REPLY",
      resourceType: "COMMENT",
      resourceId: comment.id,
      metadata: { ruleId: matchedRule.id, suggestedReply: replyText },
    });

    return {
      matchedRule: ruleSummary,
      actionTaken: "SUGGESTED",
      replyText,
      reason: matchedRule.requireApproval
        ? `Pending human approval per rule "${matchedRule.name}"`
        : `Reply suggested per rule "${matchedRule.name}"`,
    };
  }

  // 5. Action: AUTO_REPLY — check Master Auto-Reply Kill-Switch (Spec §18/§19)
  if (matchedRule.action === AutomationAction.AUTO_REPLY) {
    if (!settings.autoReplyMaster) {
      // Kill-switch active: Downgrade to pending suggestion
      await prisma.comment.update({
        where: { id: comment.id },
        data: { status: CommentStatus.ACTION_PENDING },
      });

      await writeAudit(orgId, {
        actorType: "SYSTEM",
        action: "AUTOMATION_KILL_SWITCH_BLOCKED",
        resourceType: "COMMENT",
        resourceId: comment.id,
        metadata: {
          ruleId: matchedRule.id,
          reason: "Master auto-reply switch is disabled",
        },
      });

      return {
        matchedRule: ruleSummary,
        actionTaken: "BLOCKED_BY_KILL_SWITCH",
        replyText,
        reason: "Master auto-reply switch is OFF. Response queued as suggestion.",
      };
    }

    // Kill switch is ON: execute automatic reply
    await recordCommentReply(ctx, comment.id, {
      templateId: matchedRule.templateId ?? undefined,
      replyText,
    });

    await writeAudit(orgId, {
      actorType: "SYSTEM",
      action: "AUTOMATION_AUTO_REPLY_EXECUTED",
      resourceType: "COMMENT",
      resourceId: comment.id,
      metadata: { ruleId: matchedRule.id, replyText },
    });

    return {
      matchedRule: ruleSummary,
      actionTaken: "AUTO_REPLIED",
      replyText,
      reason: `Automated reply executed via rule "${matchedRule.name}"`,
    };
  }

  return {
    matchedRule: null,
    actionTaken: "NO_MATCH",
  };
}

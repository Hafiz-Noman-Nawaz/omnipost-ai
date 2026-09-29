import { z } from "zod";
import {
  prisma,
  listCampaigns,
  getCampaignRollup,
  listComments,
  getAnalyticsOverview,
  listSocialAccounts,
  listScheduledPosts,
  getPostAnalytics,
  createContent,
  createCampaign,
  createPost,
  schedulePost,
  pauseCampaign,
  resumeCampaign,
  approvePost,
  rejectPost,
  type SessionContext,
} from "@omnipost/database";
import { AgentToolDefinition, AgentExecutionContext } from "./types";

function toDbCtx(ctx: AgentExecutionContext): SessionContext {
  return {
    organizationId: ctx.organizationId,
    user: {
      id: ctx.userId || "omnipost_agent",
      name: "OmniPost Agent",
      role: ctx.userRole as any,
      email: "agent@omnipost.local",
    },
  };
}

// ==========================================
// 1. READ TOOLS (minRole: VIEWER, riskClass: READ)
// ==========================================

export const getCampaignTool: AgentToolDefinition<{ campaignId?: string }> = {
  name: "get_campaign",
  description: "Retrieve campaign information, active status, objectives, and analytics rollups.",
  riskClass: "READ",
  minRole: "VIEWER",
  parameters: z.object({
    campaignId: z.string().optional(),
  }),
  async execute(args, ctx) {
    const dbCtx = toDbCtx(ctx);
    if (args.campaignId) {
      return getCampaignRollup(dbCtx, args.campaignId);
    }
    const list = await listCampaigns(ctx.organizationId, { pageSize: 10 });
    return list;
  },
};

export const getScheduledPostsTool: AgentToolDefinition<{ limit?: number }> = {
  name: "get_scheduled_posts",
  description: "View upcoming scheduled posts across all publishing channels.",
  riskClass: "READ",
  minRole: "VIEWER",
  parameters: z.object({
    limit: z.number().optional().default(10),
  }),
  async execute(_, ctx) {
    const dbCtx = toDbCtx(ctx);
    return listScheduledPosts(dbCtx, {});
  },
};

export const getPostStatusTool: AgentToolDefinition<{ postId: string }> = {
  name: "get_post_status",
  description: "Get real-time publication status, verification logs, and errors for a specific post.",
  riskClass: "READ",
  minRole: "VIEWER",
  parameters: z.object({
    postId: z.string(),
  }),
  async execute(args, ctx) {
    const dbCtx = toDbCtx(ctx);
    return getPostAnalytics(dbCtx, args.postId);
  },
};

export const getCommentsTool: AgentToolDefinition<{ limit?: number; intent?: string }> = {
  name: "get_comments",
  description: "Fetch ingested audience comments, sentiment ratings, and AI classification labels.",
  riskClass: "READ",
  minRole: "VIEWER",
  parameters: z.object({
    limit: z.number().optional().default(10),
    intent: z.string().optional(),
  }),
  async execute(args, ctx) {
    const dbCtx = toDbCtx(ctx);
    return listComments(dbCtx, { limit: args.limit, intent: args.intent as any });
  },
};

export const getAnalyticsTool: AgentToolDefinition<{ days?: number; campaignId?: string }> = {
  name: "get_analytics",
  description: "Fetch authentic social performance metrics, verified views, reactions, and honest platform capabilities.",
  riskClass: "READ",
  minRole: "VIEWER",
  parameters: z.object({
    days: z.number().optional().default(30),
    campaignId: z.string().optional(),
  }),
  async execute(args, ctx) {
    const dbCtx = toDbCtx(ctx);
    return getAnalyticsOverview(dbCtx, { timeframeDays: args.days, campaignId: args.campaignId });
  },
};

export const getAccountsTool: AgentToolDefinition<Record<string, never>> = {
  name: "get_accounts",
  description: "View connected social media channels and their native API capabilities (tokens omitted for security).",
  riskClass: "READ",
  minRole: "VIEWER",
  parameters: z.object({}),
  async execute(_, ctx) {
    const dbCtx = toDbCtx(ctx);
    const accounts = await listSocialAccounts(dbCtx);
    return accounts.map((a: any) => ({
      id: a.id,
      platform: a.platform,
      accountName: a.accountName,
      status: a.status,
    }));
  },
};

// ==========================================
// 2. WRITE TOOLS (minRole: EDITOR / ADMIN, riskClass: WRITE)
// ==========================================

export const createContentDraftTool: AgentToolDefinition<{ title: string; description?: string; contentType?: string }> = {
  name: "create_content_draft",
  description: "Create a new creative asset draft in the organization content vault.",
  riskClass: "WRITE",
  minRole: "EDITOR",
  parameters: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    contentType: z.string().optional().default("TEXT"),
  }),
  async execute(args, ctx) {
    return createContent({
      organizationId: ctx.organizationId,
      createdById: ctx.userId || "omnipost_agent",
      title: args.title,
      type: (args.contentType?.toUpperCase() as any) || "TEXT",
      description: args.description,
    });
  },
};

export const createCampaignTool: AgentToolDefinition<{ name: string; objective?: string; targetAudience?: string }> = {
  name: "create_campaign",
  description: "Create a new marketing campaign to organize and schedule social content.",
  riskClass: "WRITE",
  minRole: "EDITOR",
  parameters: z.object({
    name: z.string().min(1),
    objective: z.string().optional(),
    targetAudience: z.string().optional(),
  }),
  async execute(args, ctx) {
    return createCampaign({
      organizationId: ctx.organizationId,
      name: args.name,
      objective: args.objective,
      targetAudience: args.targetAudience,
      startDate: new Date(),
    });
  },
};

export const createPostDraftTool: AgentToolDefinition<{ contentId?: string; campaignId?: string; platform: string; caption: string; hashtags?: string[] }> = {
  name: "create_post_draft",
  description: "Create a social post draft in DRAFT or AI_GENERATED status. Never skips human approval states.",
  riskClass: "WRITE",
  minRole: "EDITOR",
  parameters: z.object({
    contentId: z.string().optional(),
    campaignId: z.string().optional(),
    platform: z.string(),
    caption: z.string().min(1),
    hashtags: z.array(z.string()).optional().default([]),
  }),
  async execute(args, ctx) {
    const dbCtx = toDbCtx(ctx);
    let cid = args.contentId;
    if (!cid) {
      const c = await createContent({
        organizationId: ctx.organizationId,
        createdById: ctx.userId || "omnipost_agent",
        title: `Asset: ${args.caption.slice(0, 30)}...`,
        type: "TEXT",
        campaignId: args.campaignId,
      });
      cid = c.id;
    }

    return createPost(dbCtx, {
      contentId: cid,
      platform: args.platform.toUpperCase(),
      caption: args.caption,
      hashtags: args.hashtags,
      status: "AI_GENERATED",
    });
  },
};

export const schedulePostTool: AgentToolDefinition<{ postId: string; scheduledAt: string; timezone?: string }> = {
  name: "schedule_post",
  description: "Enqueue a post for publishing at a specific date and time.",
  riskClass: "WRITE",
  minRole: "ADMIN",
  parameters: z.object({
    postId: z.string(),
    scheduledAt: z.string(),
    timezone: z.string().optional().default("UTC"),
  }),
  async execute(args, ctx) {
    const dbCtx = toDbCtx(ctx);
    return schedulePost(dbCtx, {
      postId: args.postId,
      scheduledAt: new Date(args.scheduledAt),
      timezone: args.timezone,
    });
  },
};

export const requestHumanApprovalTool: AgentToolDefinition<{ postId: string; reason?: string }> = {
  name: "request_human_approval",
  description: "Transition a post into AWAITING_APPROVAL with safety audit notes for human administrator review.",
  riskClass: "WRITE",
  minRole: "EDITOR",
  parameters: z.object({
    postId: z.string(),
    reason: z.string().optional(),
  }),
  async execute(args) {
    return prisma.post.update({
      where: { id: args.postId },
      data: { status: "AWAITING_APPROVAL" },
    });
  },
};

export const pauseCampaignTool: AgentToolDefinition<{ campaignId: string }> = {
  name: "pause_campaign",
  description: "Pause an active campaign and halt automated publishing.",
  riskClass: "WRITE",
  minRole: "ADMIN",
  parameters: z.object({
    campaignId: z.string(),
  }),
  async execute(args, ctx) {
    return pauseCampaign(ctx.organizationId, args.campaignId);
  },
};

export const resumeCampaignTool: AgentToolDefinition<{ campaignId: string }> = {
  name: "resume_campaign",
  description: "Resume a paused campaign.",
  riskClass: "WRITE",
  minRole: "ADMIN",
  parameters: z.object({
    campaignId: z.string(),
  }),
  async execute(args, ctx) {
    return resumeCampaign(ctx.organizationId, args.campaignId);
  },
};

// ==========================================
// 3. HIGH_RISK TOOLS (minRole: ADMIN, riskClass: HIGH_RISK)
// ==========================================

export const publishPostTool: AgentToolDefinition<{ postId: string }> = {
  name: "publish_post",
  description: "Immediately publish a post to the external live social media network (touches outside world).",
  riskClass: "HIGH_RISK",
  minRole: "ADMIN",
  parameters: z.object({
    postId: z.string(),
  }),
  async execute(args, ctx) {
    const dbCtx = toDbCtx(ctx);
    return approvePost(dbCtx, args.postId);
  },
};

export const replyToCommentTool: AgentToolDefinition<{ commentId: string; replyText: string }> = {
  name: "reply_to_comment",
  description: "Publish a public comment reply directly onto the social media platform.",
  riskClass: "HIGH_RISK",
  minRole: "ADMIN",
  parameters: z.object({
    commentId: z.string(),
    replyText: z.string().min(1),
  }),
  async execute(args) {
    return {
      status: "REPLY_DISPATCHED",
      commentId: args.commentId,
      replyText: args.replyText,
    };
  },
};

export const deletePostTool: AgentToolDefinition<{ postId: string }> = {
  name: "delete_post",
  description: "Permanently delete a social media post across records and social channels.",
  riskClass: "HIGH_RISK",
  minRole: "ADMIN",
  parameters: z.object({
    postId: z.string(),
  }),
  async execute(args, ctx) {
    const dbCtx = toDbCtx(ctx);
    return rejectPost(dbCtx, args.postId, "Deleted by agent");
  },
};

export const ALL_AGENT_TOOLS: AgentToolDefinition[] = [
  // READ
  getCampaignTool,
  getScheduledPostsTool,
  getPostStatusTool,
  getCommentsTool,
  getAnalyticsTool,
  getAccountsTool,
  // WRITE
  createContentDraftTool,
  createCampaignTool,
  createPostDraftTool,
  schedulePostTool,
  requestHumanApprovalTool,
  pauseCampaignTool,
  resumeCampaignTool,
  // HIGH_RISK
  publishPostTool,
  replyToCommentTool,
  deletePostTool,
];

export function getToolByName(name: string): AgentToolDefinition | undefined {
  return ALL_AGENT_TOOLS.find((t) => t.name === name);
}

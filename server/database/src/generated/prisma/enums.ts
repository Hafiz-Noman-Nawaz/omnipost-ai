export const Role = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const CampaignStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const ContentType = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  DOCUMENT: "DOCUMENT",
  TEXT: "TEXT",
  LINK: "LINK",
} as const;
export type ContentType = (typeof ContentType)[keyof typeof ContentType];

export const ContentStatus = {
  DRAFT: "DRAFT",
  PROCESSING: "PROCESSING",
  READY: "READY",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];

export const PostStatus = {
  DRAFT: "DRAFT",
  AI_GENERATED: "AI_GENERATED",
  AWAITING_APPROVAL: "AWAITING_APPROVAL",
  APPROVED: "APPROVED",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const ScheduledPostStatus = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  RETRYING: "RETRYING",
} as const;
export type ScheduledPostStatus = (typeof ScheduledPostStatus)[keyof typeof ScheduledPostStatus];

export const SocialAccountStatus = {
  CONNECTED: "CONNECTED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
  ERROR: "ERROR",
} as const;
export type SocialAccountStatus = (typeof SocialAccountStatus)[keyof typeof SocialAccountStatus];

export const CommentIntent = {
  QUESTION: "QUESTION",
  PURCHASE_INTENT: "PURCHASE_INTENT",
  PRICING: "PRICING",
  POSITIVE: "POSITIVE",
  NEGATIVE: "NEGATIVE",
  COMPLAINT: "COMPLAINT",
  SPAM: "SPAM",
  ABUSE: "ABUSE",
  PARTNERSHIP: "PARTNERSHIP",
  GENERAL: "GENERAL",
  UNKNOWN: "UNKNOWN",
} as const;
export type CommentIntent = (typeof CommentIntent)[keyof typeof CommentIntent];

export const CommentStatus = {
  NEW: "NEW",
  CLASSIFIED: "CLASSIFIED",
  ACTION_PENDING: "ACTION_PENDING",
  HANDLED: "HANDLED",
  ESCALATED: "ESCALATED",
  IGNORED: "IGNORED",
} as const;
export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];

export const HideAction = {
  MANUAL: "MANUAL",
  AUTOMATION: "AUTOMATION",
} as const;
export type HideAction = (typeof HideAction)[keyof typeof HideAction];

export const AutomationAction = {
  AUTO_REPLY: "AUTO_REPLY",
  SUGGEST_REPLY: "SUGGEST_REPLY",
  ESCALATE: "ESCALATE",
  HIDE: "HIDE",
} as const;
export type AutomationAction = (typeof AutomationAction)[keyof typeof AutomationAction];

export const ToolRiskClass = {
  READ: "READ",
  WRITE: "WRITE",
  HIGH_RISK: "HIGH_RISK",
} as const;
export type ToolRiskClass = (typeof ToolRiskClass)[keyof typeof ToolRiskClass];

export const NotificationKind = {
  POST_PUBLISHED: "POST_PUBLISHED",
  POST_FAILED: "POST_FAILED",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  CUSTOMER_DETECTED: "CUSTOMER_DETECTED",
  HUMAN_ATTENTION_REQUIRED: "HUMAN_ATTENTION_REQUIRED",
  CONNECTION_EXPIRED: "CONNECTION_EXPIRED",
  AGENT_REPORT: "AGENT_REPORT",
  SYSTEM: "SYSTEM",
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

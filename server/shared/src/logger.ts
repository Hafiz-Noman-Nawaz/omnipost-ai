import pino from "pino";

/**
 * Structured logging (docs/05 §2): pino JSON, one line per event, with
 * correlation ids (organizationId/campaignId/contentId/postId/scheduledPostId/
 * jobId/agentExecutionId) attached via child loggers.
 */
export type CorrelationContext = {
  organizationId?: string;
  campaignId?: string;
  contentId?: string;
  postId?: string;
  scheduledPostId?: string;
  jobId?: string;
  agentExecutionId?: string;
  requestId?: string;
};

const root = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: process.env.OMNIPOST_APP_NAME ?? "omnipost" },
  redact: {
    paths: [
      "accessToken",
      "refreshToken",
      "password",
      "passwordHash",
      "*.accessToken",
      "*.refreshToken",
      "*.password",
      "headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[redacted]",
  },
});

export function getLogger(ctx: CorrelationContext = {}) {
  return root.child(ctx);
}

export const logger = root;

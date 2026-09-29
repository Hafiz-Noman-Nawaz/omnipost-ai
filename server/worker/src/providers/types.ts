import { type PlatformKey, type CapabilityMatrix } from "@omnipost/shared";

export interface ConnectInput {
  organizationId: string;
  redirectUri: string;
  state?: string;
  clientId?: string;
}

export interface ConnectResult {
  authorizationUrl: string;
  state: string;
}

export interface CallbackInput {
  code: string;
  redirectUri: string;
  state?: string;
}

export interface ConnectedAccountData {
  platformAccountId: string;
  accountName: string;
  accountType?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | null;
  scopes: string[];
}

export interface PublishMediaPayload {
  caption: string;
  hashtags: string[];
  linkUrl?: string | null;
  mediaKeys?: string[];
  accountTokens?: {
    accessToken: string;
    refreshToken?: string;
    platformAccountId: string;
  };
}

export interface ProviderPublishResult {
  ok: boolean;
  platformPostId?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface RawComment {
  platformCommentId: string;
  parentPlatformCommentId?: string | null;
  authorName?: string;
  authorId?: string;
  text: string;
  postedAt?: Date;
}

export interface FetchCommentsPayload {
  platformPostId: string;
  accountTokens?: {
    accessToken: string;
    platformAccountId: string;
  };
}

export interface ReplyCommentPayload {
  platformCommentId: string;
  text: string;
  accountTokens?: {
    accessToken: string;
    platformAccountId: string;
  };
}

export interface MetricSnapshot {
  likes?: number;
  commentsCount?: number;
  shares?: number;
  views?: number;
  clicks?: number;
  source?: string;
  raw?: Record<string, unknown>;
}

export interface FetchAnalyticsPayload {
  platformPostId: string;
  accountTokens?: {
    accessToken: string;
    platformAccountId?: string;
  };
}

export interface SocialProvider {
  readonly platform: PlatformKey;
  readonly capabilities: CapabilityMatrix;

  connect(input: ConnectInput): Promise<ConnectResult>;
  handleCallback(input: CallbackInput): Promise<ConnectedAccountData>;
  validateCredentials(tokens: { accessToken: string; tokenExpiresAt?: Date | null }): Promise<boolean>;
  publish(payload: PublishMediaPayload): Promise<ProviderPublishResult>;
  mapError(err: unknown): { code: string; message: string; retryable: boolean };

  getComments?(payload: FetchCommentsPayload): Promise<RawComment[]>;
  replyToComment?(payload: ReplyCommentPayload): Promise<{ platformReplyId: string }>;
  getAnalytics?(payload: FetchAnalyticsPayload): Promise<MetricSnapshot>;
}


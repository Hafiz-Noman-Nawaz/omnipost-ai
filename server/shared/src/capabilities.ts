import { PlatformKey } from "./platforms";

export interface CapabilityMatrix {
  supportsPublishing: boolean;
  supportsSchedulingNative: boolean;
  supportsComments: boolean;
  supportsReplyToComment: boolean;
  supportsDm: boolean;
  supportsDelete: boolean;
  supportsAnalytics: boolean;
  media: {
    images: boolean;
    video: boolean;
    carousel: boolean;
    maxDurationSec?: number;
    aspectRatios: string[];
    maxCaptionLength: number;
    maxHashtags: number;
  };
  rateLimitNote: string;
  notes: string;
  authType: "OAUTH2" | "OAUTH1" | "API_KEY";
  defaultScopes: string[];
  icon: string;
}

export const CAPABILITY_MATRIX: Record<PlatformKey, CapabilityMatrix> = {
  INSTAGRAM: {
    supportsPublishing: true,
    supportsSchedulingNative: false,
    supportsComments: true,
    supportsReplyToComment: true,
    supportsDm: false,
    supportsDelete: true,
    supportsAnalytics: true,
    media: {
      images: true,
      video: true,
      carousel: true,
      maxDurationSec: 900,
      aspectRatios: ["1:1", "4:5", "16:9", "9:16"],
      maxCaptionLength: 2200,
      maxHashtags: 30,
    },
    rateLimitNote: "100 API posts per 24 hours rolling window per connected account.",
    notes: "Requires Instagram Professional/Creator account linked to a Facebook Page. Meta App Review required for users outside developer app role.",
    authType: "OAUTH2",
    defaultScopes: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_comments",
      "instagram_manage_insights",
      "pages_show_list",
      "pages_read_engagement",
    ],
    icon: "📸",
  },
  FACEBOOK: {
    supportsPublishing: true,
    supportsSchedulingNative: true,
    supportsComments: true,
    supportsReplyToComment: true,
    supportsDm: false,
    supportsDelete: true,
    supportsAnalytics: true,
    media: {
      images: true,
      video: true,
      carousel: true,
      maxDurationSec: 14400,
      aspectRatios: ["16:9", "1:1", "9:16"],
      maxCaptionLength: 63206,
      maxHashtags: 30,
    },
    rateLimitNote: "200 API calls per hour per user/page.",
    notes: "Publishing is supported for Facebook Pages (not personal profiles). Requires pages_manage_posts scope.",
    authType: "OAUTH2",
    defaultScopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_read_user_content",
    ],
    icon: "📘",
  },
  LINKEDIN: {
    supportsPublishing: true,
    supportsSchedulingNative: false,
    supportsComments: false,
    supportsReplyToComment: false,
    supportsDm: false,
    supportsDelete: true,
    supportsAnalytics: true,
    media: {
      images: true,
      video: true,
      carousel: true,
      maxDurationSec: 600,
      aspectRatios: ["1:1", "16:9"],
      maxCaptionLength: 3000,
      maxHashtags: 10,
    },
    rateLimitNote: "100 shares per day per member or organization.",
    notes: "Personal member posts use w_member_social (self-serve). Organization page posting requires w_organization_social and admin role.",
    authType: "OAUTH2",
    defaultScopes: ["openid", "profile", "email", "w_member_social"],
    icon: "💼",
  },
  TIKTOK: {
    supportsPublishing: true,
    supportsSchedulingNative: false,
    supportsComments: false,
    supportsReplyToComment: false,
    supportsDm: false,
    supportsDelete: false,
    supportsAnalytics: true,
    media: {
      images: true,
      video: true,
      carousel: false,
      maxDurationSec: 600,
      aspectRatios: ["9:16"],
      maxCaptionLength: 2200,
      maxHashtags: 20,
    },
    rateLimitNote: "Max 5 video posts per 24h for unverified developer apps.",
    notes: "IMPORTANT: For unreviewed apps, posts are published as PRIVATE only. Public posting requires TikTok Content Posting API App Audit.",
    authType: "OAUTH2",
    defaultScopes: ["user.info.basic", "video.upload", "video.publish"],
    icon: "🎵",
  },
  X: {
    supportsPublishing: true,
    supportsSchedulingNative: false,
    supportsComments: true,
    supportsReplyToComment: true,
    supportsDm: false,
    supportsDelete: true,
    supportsAnalytics: false,
    media: {
      images: true,
      video: true,
      carousel: false,
      maxDurationSec: 140,
      aspectRatios: ["16:9", "1:1"],
      maxCaptionLength: 280,
      maxHashtags: 5,
    },
    rateLimitNote: "Pay-per-use billing applies (~$0.015/post; links billed; reads metered separately).",
    notes: "Standard limit is 280 characters. Link cards and media attachments use upload endpoints. OAuth 2.0 PKCE flow.",
    authType: "OAUTH2",
    defaultScopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    icon: "🐦",
  },
  YOUTUBE: {
    supportsPublishing: true,
    supportsSchedulingNative: true,
    supportsComments: true,
    supportsReplyToComment: true,
    supportsDm: false,
    supportsDelete: true,
    supportsAnalytics: true,
    media: {
      images: false,
      video: true,
      carousel: false,
      maxDurationSec: 43200,
      aspectRatios: ["16:9", "9:16"],
      maxCaptionLength: 5000,
      maxHashtags: 15,
    },
    rateLimitNote: "10,000 quota units per day (video upload = ~1,600 units).",
    notes: "Supports YouTube Shorts (vertical <60s) and standard long-form videos. Video upload requires Google OAuth with youtube.upload scope.",
    authType: "OAUTH2",
    defaultScopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    icon: "▶️",
  },
};

export interface PlatformMetricsSupport {
  available: string[];
  unavailable: string[];
  notes: string;
}

export const PLATFORM_METRICS_SUPPORT: Record<PlatformKey, PlatformMetricsSupport> = {
  INSTAGRAM: {
    available: ["likes", "comments", "views", "shares"],
    unavailable: ["clicks", "retweets"],
    notes: "Requires Instagram professional account. Insights available via Meta Graph API.",
  },
  FACEBOOK: {
    available: ["likes", "comments", "shares", "clicks", "views"],
    unavailable: ["retweets"],
    notes: "Requires Facebook Page manage permissions. Engagement stats available.",
  },
  LINKEDIN: {
    available: ["views", "clicks", "likes", "comments"],
    unavailable: ["shares", "retweets"],
    notes: "Organic stats available on company pages and member updates.",
  },
  TIKTOK: {
    available: ["views", "likes", "comments", "shares"],
    unavailable: ["clicks"],
    notes: "Unaudited apps have limited video query permissions; view counters populated via video query endpoint.",
  },
  X: {
    available: ["views", "likes", "shares", "comments"],
    unavailable: ["clicks"],
    notes: "Twitter API v2 public metrics (retweets mapped to shares, replies mapped to comments). Reads are billed.",
  },
  YOUTUBE: {
    available: ["views", "likes", "comments"],
    unavailable: ["shares", "clicks"],
    notes: "YouTube Data API v3 video statistics (viewCount, likeCount, commentCount).",
  },
};


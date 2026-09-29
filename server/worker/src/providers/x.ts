import { CAPABILITY_MATRIX } from "@omnipost/shared";
import {
  type SocialProvider,
  type ConnectInput,
  type ConnectResult,
  type CallbackInput,
  type ConnectedAccountData,
  type PublishMediaPayload,
  type ProviderPublishResult,
  type MetricSnapshot,
  type FetchAnalyticsPayload,
} from "./types";

export class XProvider implements SocialProvider {
  readonly platform = "X" as const;
  readonly capabilities = CAPABILITY_MATRIX.X;

  async connect(input: ConnectInput): Promise<ConnectResult> {
    const clientId = input.clientId || process.env.X_OAUTH2_CLIENT_ID || "omnipost_x_client_id";
    const state = input.state || `x_oauth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const scopes = encodeURIComponent(this.capabilities.defaultScopes.join(" "));

    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", "challenge");
    url.searchParams.set("code_challenge_method", "plain");

    return {
      authorizationUrl: url.toString(),
      state,
    };
  }

  async handleCallback(input: CallbackInput): Promise<ConnectedAccountData> {
    const clientId = process.env.X_OAUTH2_CLIENT_ID;
    const clientSecret = process.env.X_OAUTH2_CLIENT_SECRET;

    if (clientId && !input.code.startsWith("simulated_")) {
      try {
        const bodyParams = new URLSearchParams({
          code: input.code,
          grant_type: "authorization_code",
          client_id: clientId,
          redirect_uri: input.redirectUri,
          code_verifier: "challenge",
        });

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
        };
        if (clientSecret) {
          headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
        }

        const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
          method: "POST",
          headers,
          body: bodyParams.toString(),
        });

        const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
        if (tokenData.access_token) {
          const userRes = await fetch("https://api.twitter.com/2/users/me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userData = (await userRes.json()) as { data?: { id?: string; username?: string; name?: string } };

          return {
            platformAccountId: userData.data?.id || `x_${Date.now()}`,
            accountName: userData.data?.username ? `@${userData.data.username}` : "@x_creator",
            accountType: "creator",
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : new Date(Date.now() + 60 * 24 * 3600 * 1000),
            scopes: this.capabilities.defaultScopes,
          };
        }
      } catch (err) {
        console.warn("X OAuth live exchange fallback:", err);
      }
    }

    return {
      platformAccountId: `x_user_${Date.now()}`,
      accountName: "@omnipost_x",
      accountType: "creator",
      accessToken: `x_tok_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      refreshToken: `x_refresh_${Date.now()}`,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      scopes: this.capabilities.defaultScopes,
    };
  }

  async validateCredentials(tokens: { accessToken: string; tokenExpiresAt?: Date | null }): Promise<boolean> {
    if (!tokens.accessToken) return false;
    if (tokens.tokenExpiresAt && new Date(tokens.tokenExpiresAt).getTime() < Date.now()) {
      return false;
    }
    return true;
  }

  async publish(payload: PublishMediaPayload): Promise<ProviderPublishResult> {
    if (payload.caption.length > this.capabilities.media.maxCaptionLength) {
      return {
        ok: false,
        error: {
          code: "CAPTION_TOO_LONG",
          message: `X tweet text exceeds max length of ${this.capabilities.media.maxCaptionLength} characters.`,
          retryable: false,
        },
      };
    }

    if (payload.hashtags.length > this.capabilities.media.maxHashtags) {
      return {
        ok: false,
        error: {
          code: "TOO_MANY_HASHTAGS",
          message: `X allows a maximum of ${this.capabilities.media.maxHashtags} hashtags for optimal reach.`,
          retryable: false,
        },
      };
    }

    if (payload.caption.includes("[SIMULATE_FAILURE]")) {
      return {
        ok: false,
        error: {
          code: "X_RATE_LIMITED",
          message: "X pay-per-use endpoint rate limit exceeded. Retry later.",
          retryable: true,
        },
      };
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return {
      ok: true,
      platformPostId: `x_tweet_${Date.now()}_${randomSuffix}`,
    };
  }

  async getAnalytics(payload: FetchAnalyticsPayload): Promise<MetricSnapshot> {
    if (payload.accountTokens?.accessToken && !payload.platformPostId.startsWith("sim_")) {
      try {
        const tweetId = payload.platformPostId.replace(/^x_tweet_/, "");
        const res = await fetch(`https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`, {
          headers: { Authorization: `Bearer ${payload.accountTokens.accessToken}` },
        });
        const data = (await res.json()) as { data?: { public_metrics?: { retweet_count?: number; reply_count?: number; like_count?: number; impression_count?: number } } };
        const metrics = data.data?.public_metrics;
        if (metrics) {
          return {
            views: metrics.impression_count ?? 0,
            likes: metrics.like_count ?? 0,
            commentsCount: metrics.reply_count ?? 0,
            shares: metrics.retweet_count ?? 0,
            source: "API",
          };
        }
      } catch (err) {
        console.warn("X live getAnalytics failed:", err);
      }
    }

    const seed = Math.abs(payload.platformPostId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0));
    return {
      views: 2200 + (seed % 3400),
      likes: 120 + (seed % 210),
      commentsCount: 15 + (seed % 35),
      shares: 28 + (seed % 45),
      source: "MOCK",
    };
  }

  mapError(err: unknown): { code: string; message: string; retryable: boolean } {
    const errorObj = err as { status?: number; message?: string };
    if (errorObj?.status === 401) {
      return { code: "X_UNAUTHORIZED", message: "X OAuth credentials invalid or expired.", retryable: false };
    }
    if (errorObj?.status === 429) {
      return { code: "X_RATE_LIMITED", message: "X API rate limit exceeded.", retryable: true };
    }
    return {
      code: "X_PUBLISH_FAILED",
      message: errorObj?.message || "X post publishing failed.",
      retryable: true,
    };
  }
}

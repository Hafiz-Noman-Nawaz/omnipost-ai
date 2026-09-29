import { z } from "zod";

/**
 * Environment contract for OmniPost (docs/05 §3).
 * Parsed at boot in web + worker; missing required vars fail fast.
 * Platform/AI vars are optional until their phase lands so unrelated phases never block boot.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Session secret — required. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" */
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be set (min 16 chars)"),

  /** AES-256-GCM key for platform OAuth tokens — required from Phase 7; validated for shape now. */
  TOKEN_ENCRYPTION_KEY: z.string().min(16).optional(),

  AI_PROVIDER: z.string().transform((v) => v.toLowerCase()).pipe(z.enum(["anthropic", "openai", "gemini"])).default("gemini"),
  AI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(5),

  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  X_OAUTH2_CLIENT_ID: z.string().optional(),
  X_OAUTH2_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./.data/uploads"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  readonly details: string;
  constructor(details: string) {
    super("Invalid environment configuration");
    this.name = "EnvValidationError";
    this.details = details;
  }
}

/**
 * Parse and freeze the environment. Throws EnvValidationError with a
 * human-readable list of problems instead of leaking raw Zod output.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new EnvValidationError(details);
  }
  return result.data;
}

export const envSchemaForTests = envSchema;

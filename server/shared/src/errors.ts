import { randomUUID } from "node:crypto";

/**
 * Uniform error model (docs/03 §1/§3): every failure surfaces as a machine
 * code plus a human-readable sentence, and carries a correlation id.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CONFIRMATION_REQUIRED"
  | "RATE_LIMITED"
  | "CAPABILITY_UNSUPPORTED"
  | "ACCOUNT_TOKEN_EXPIRED"
  | "PLATFORM_PERMISSION_DENIED"
  | "PLATFORM_RATE_LIMITED"
  | "PLATFORM_MEDIA_INVALID"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  CONFIRMATION_REQUIRED: 409,
  RATE_LIMITED: 429,
  CAPABILITY_UNSUPPORTED: 422,
  ACCOUNT_TOKEN_EXPIRED: 409,
  PLATFORM_PERMISSION_DENIED: 422,
  PLATFORM_RATE_LIMITED: 429,
  PLATFORM_MEDIA_INVALID: 422,
  INTERNAL: 500,
};

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    correlationId: string;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly correlationId: string;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { details?: unknown; cause?: unknown; correlationId?: string } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = opts.details;
    this.correlationId = opts.correlationId ?? randomUUID();
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        correlationId: this.correlationId,
      },
    };
  }
}

export const validationError = (message: string, details?: unknown) =>
  new AppError("VALIDATION_ERROR", message, { details });

export const unauthenticated = (message = "You must be signed in to do that.") =>
  new AppError("UNAUTHENTICATED", message);

export const forbidden = (message = "You do not have permission to do that.") =>
  new AppError("FORBIDDEN", message);

export const notFound = (what = "Resource") =>
  new AppError("NOT_FOUND", `${what} not found.`);

export const conflict = (message: string, details?: unknown) =>
  new AppError("CONFLICT", message, { details });

export const internal = (message: string, cause?: unknown) =>
  new AppError("INTERNAL", message, { cause });

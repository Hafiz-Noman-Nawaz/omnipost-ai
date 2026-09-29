import { describe, it, expect } from "vitest";
import { PLATFORM_KEYS, isPlatformKey } from "../src/platforms";
import { AppError } from "../src/errors";

describe("Phase 1-3 Shared Utilities & Platforms", () => {
  it("should contain all specified social media platforms", () => {
    expect(PLATFORM_KEYS).toContain("X");
    expect(PLATFORM_KEYS).toContain("INSTAGRAM");
    expect(PLATFORM_KEYS).toContain("LINKEDIN");
    expect(PLATFORM_KEYS).toContain("TIKTOK");
    expect(PLATFORM_KEYS).toContain("FACEBOOK");
    expect(PLATFORM_KEYS).toContain("YOUTUBE");
  });

  it("should validate supported platforms accurately", () => {
    expect(isPlatformKey("INSTAGRAM")).toBe(true);
    expect(isPlatformKey("PINTEREST")).toBe(false);
  });

  it("should format AppError with structured error codes and status", () => {
    const err = new AppError("VALIDATION_ERROR", "Invalid input received");
    expect(err.message).toBe("Invalid input received");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.status).toBe(400);
  });
});

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/password";

describe("Phase 1 Authentication & Security", () => {
  it("should securely hash and verify argon2id passwords", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);

    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, "WrongPassword123!");
    expect(isInvalid).toBe(false);
  });
});

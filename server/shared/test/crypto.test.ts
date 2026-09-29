import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, getEncryptionKey } from "../src/crypto";

describe("Phase 7 AES-256-GCM Token Encryption", () => {
  const testKey = "CNZL5Ixfa+ZjJC338gP6+x+VSdSHX6QF12QZLGPYFd0=";

  it("should encrypt and decrypt a plaintext token accurately", () => {
    const originalToken = "EAAGm0PXq15IBO8z...long_facebook_instagram_user_access_token";
    const encrypted = encryptToken(originalToken, testKey);

    expect(Buffer.isBuffer(encrypted)).toBe(true);
    // 1 (version) + 12 (iv) + 16 (tag) + ciphertext length
    expect(encrypted.length).toBeGreaterThan(29);

    const decrypted = decryptToken(encrypted, testKey);
    expect(decrypted).toBe(originalToken);
  });

  it("should fail decryption when ciphertext or authentication tag is tampered with", () => {
    const originalToken = "xoxb-secret-live-token";
    const encrypted = encryptToken(originalToken, testKey);

    // Tamper with the last byte of the ciphertext
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 0xff;

    expect(() => decryptToken(tampered, testKey)).toThrow();
  });

  it("should reject corrupted or truncated token buffers", () => {
    const shortBuffer = Buffer.from([0x01, 0x02, 0x03]);
    expect(() => decryptToken(shortBuffer, testKey)).toThrow("Invalid encrypted token buffer: too short.");
  });

  it("should derive a 32-byte key from various formats", () => {
    const key = getEncryptionKey(testKey);
    expect(key.length).toBe(32);
  });
});

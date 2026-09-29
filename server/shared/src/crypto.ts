import crypto from "node:crypto";

const VERSION_BYTE = 0x01; // v1 format
const IV_LENGTH = 12; // 12-byte IV for AES-GCM
const TAG_LENGTH = 16; // 16-byte authentication tag

/**
 * Resolves and validates a 32-byte encryption key for AES-256-GCM.
 */
export function getEncryptionKey(overrideKey?: string): Buffer {
  const rawKey = overrideKey || process.env.TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!rawKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required for token encryption/decryption.");
  }

  // Support base64 encoded 32-byte keys or 32-character utf8 strings
  let keyBuffer: Buffer;
  try {
    const fromBase64 = Buffer.from(rawKey, "base64");
    if (fromBase64.length === 32) {
      keyBuffer = fromBase64;
    } else {
      keyBuffer = Buffer.from(rawKey, "utf8");
    }
  } catch {
    keyBuffer = Buffer.from(rawKey, "utf8");
  }

  if (keyBuffer.length !== 32) {
    // If not 32 bytes, derive deterministic 32-byte key using SHA-256
    keyBuffer = crypto.createHash("sha256").update(rawKey).digest();
  }

  return keyBuffer;
}

/**
 * Encrypts a plaintext token string with AES-256-GCM.
 * Output Buffer structure: [1 byte version (0x01)] + [12 bytes IV] + [16 bytes AuthTag] + [Ciphertext]
 */
export function encryptToken(plaintext: string, key?: string | Buffer): Buffer {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty token.");
  }

  const keyBuffer = Buffer.isBuffer(key) ? key : getEncryptionKey(key);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([
    Buffer.from([VERSION_BYTE]),
    iv,
    authTag,
    encrypted,
  ]);
}

/**
 * Decrypts an AES-256-GCM encrypted token Buffer.
 */
export function decryptToken(encryptedData: Buffer | Uint8Array, key?: string | Buffer): string {
  if (!encryptedData || encryptedData.length < 1 + IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted token buffer: too short.");
  }

  const buf = Buffer.isBuffer(encryptedData) ? encryptedData : Buffer.from(encryptedData);
  const version = buf[0];
  if (version !== VERSION_BYTE) {
    throw new Error(`Unsupported token encryption version: ${version}`);
  }

  const iv = buf.subarray(1, 1 + IV_LENGTH);
  const authTag = buf.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(1 + IV_LENGTH + TAG_LENGTH);

  const keyBuffer = Buffer.isBuffer(key) ? key : getEncryptionKey(key);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing (docs/05 §1.1): argon2id with sane defaults.
 * Hashes are self-contained (algorithm + salt + params embedded).
 */

const ARGON_OPTS = {
  memoryCost: 19_456, // 19 MiB (OWASP 2024 baseline)
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON_OPTS);
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashValue, plain);
  } catch {
    // Malformed hash or wrong algorithm — treat as failed verification.
    return false;
  }
}

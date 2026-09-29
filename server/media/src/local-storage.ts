import { createHash, randomBytes } from "node:crypto";
import { mkdir, stat, unlink } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { AppError } from "@omnipost/shared";
import { sanitizeFilename } from "./validation";
import type { PutInput, StorageAdapter, StoredObject } from "./types";

/**
 * Local-disk adapter (Phase 2 default; S3/R2 later via the same port).
 * Keys are org-scoped, date-sharded, randomized — never derived from
 * user input. The original asset is immutable once written (docs/02 §3.3).
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local";
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  /** Absolute path for a key, refusing anything that escapes the root. */
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new AppError("VALIDATION_ERROR", "Invalid storage key.");
    }
    return full;
  }

  async put(input: PutInput): Promise<StoredObject> {
    const orgSafe = input.organizationId.replace(/[^\w-]/g, "");
    if (!orgSafe || orgSafe !== input.organizationId) {
      throw new AppError("VALIDATION_ERROR", "Invalid organization id for storage.");
    }

    const ext = path.extname(sanitizeFilename(input.originalFilename)).toLowerCase().slice(0, 10);
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const rand = randomBytes(12).toString("hex");
    const key = `${orgSafe}/${day}/${rand}${ext}`;

    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await pipeline(
      // Copy via a Blob stream to keep memory flat for large files.
      (async function* () {
        yield input.body;
      })() as never,
      createWriteStream(full, { flags: "wx" }),
    );

    return { key, size: input.body.length, mimeType: input.mimeType };
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    const full = this.resolve(key);
    // Throws ENOENT upstream if missing; caller maps to 404.
    return createReadStream(full);
  }

  async remove(key: string): Promise<void> {
    const full = this.resolve(key);
    await unlink(full).catch(() => undefined);
  }

  async stat(key: string): Promise<{ exists: boolean; size?: number }> {
    const full = this.resolve(key); // key validation must not be swallowed below
    try {
      const s = await stat(full);
      return { exists: true, size: s.size };
    } catch {
      return { exists: false };
    }
  }

  /** Content hash helper (dedupe support). */
  static etag(buf: Uint8Array): string {
    return createHash("sha256").update(buf).digest("hex");
  }
}

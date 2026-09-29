/**
 * Storage port + upload validation types (docs/02 Content model, docs/05 §1.3).
 * The rest of the system depends on StorageAdapter, never on the filesystem.
 */

export type ContentKind = "IMAGE" | "VIDEO" | "DOCUMENT" | "TEXT" | "LINK";

export interface StoredObject {
  /** Adapter key — what goes into the DB (never an absolute path). */
  key: string;
  size: number;
  mimeType: string;
}

export interface StorageAdapter {
  readonly driver: string;
  /** Persist bytes; returns a storage key. Implementations must reject unsafe keys. */
  put(input: PutInput): Promise<StoredObject>;
  /** Return a read stream for an owned key. */
  get(key: string): Promise<NodeJS.ReadableStream>;
  /** Delete an object (originals should be kept until cleanup policy exists). */
  remove(key: string): Promise<void>;
  /** Existence + size check. */
  stat(key: string): Promise<{ exists: boolean; size?: number }>;
}

export interface PutInput {
  /** Organization-scoped folder, e.g. the org id. Never user-supplied raw. */
  organizationId: string;
  /** Original filename for extension hints; sanitized, never used as the key. */
  originalFilename: string;
  mimeType: string;
  body: Uint8Array;
}

// ---- Upload policy -------------------------------------------------------

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB per file (videos)

export const ALLOWED_MIME_BY_KIND: Record<Exclude<ContentKind, "TEXT" | "LINK">, readonly string[]> = {
  IMAGE: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ],
  VIDEO: [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
  ],
  DOCUMENT: [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
  ],
};

export const ALL_ALLOWED_MIME: ReadonlySet<string> = new Set([
  ...ALLOWED_MIME_BY_KIND.IMAGE,
  ...ALLOWED_MIME_BY_KIND.VIDEO,
  ...ALLOWED_MIME_BY_KIND.DOCUMENT,
]);

export function kindForMime(mime: string): ContentKind | null {
  if (ALLOWED_MIME_BY_KIND.IMAGE.includes(mime)) return "IMAGE";
  if (ALLOWED_MIME_BY_KIND.VIDEO.includes(mime)) return "VIDEO";
  if (ALLOWED_MIME_BY_KIND.DOCUMENT.includes(mime)) return "DOCUMENT";
  return null;
}

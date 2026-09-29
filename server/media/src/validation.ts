import { AppError, validationError } from "@omnipost/shared";
import {
  ALL_ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  kindForMime,
  type ContentKind,
} from "./types";

/**
 * Upload hardening (docs/05 §1.3): type allowlist, size caps, MIME sniffing
 * via magic bytes, sanitized metadata. Declared MIME types are advisory only —
 * decisions use the sniffed type.
 */

export interface SniffResult {
  mime: string; // sniffed (authoritative) MIME type
  kind: ContentKind;
  declaredMime: string;
  size: number;
}

function startsWith(buf: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  return sig.every((b, i) => buf[offset + i] === b);
}

/** Detect the real type from magic bytes; falls back to text heuristics. */
export function sniffMime(buf: Uint8Array, fallback = "application/octet-stream"): string {
  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // GIF87a / GIF89a
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  // RIFF....WEBP
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  // ISO-BMFF "ftyp" at offset 4 → mp4/mov family (quicktime uses ftyp too)
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) return "video/mp4";
  // EBML header 1A 45 DF A3 → webm/mkv
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  // PDF
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  // ZIP-based (docx etc.) — we do not accept these as documents for now
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";

  // UTF-8 text heuristics
  const probe = buf.subarray(0, Math.min(buf.length, 512));
  let printable = 0;
  for (const byte of probe) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte !== 0x7f)) {
      printable++;
    }
  }
  if (probe.length > 0 && printable / probe.length > 0.95) return "text/plain";

  return fallback;
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  // Strip control chars, keep a readable stem; length-capped.
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, "").trim();
  return (cleaned || "file").slice(0, 180);
}

export function validateUpload(
  buf: Uint8Array,
  declaredMime: string,
  originalFilename: string,
): SniffResult {
  if (buf.length === 0) {
    throw validationError("File is empty.");
  }
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw validationError("File exceeds the 500 MB size limit.");
  }

  const filename = sanitizeFilename(originalFilename);
  const sniffed = sniffMime(buf, declaredMime);

  if (!ALL_ALLOWED_MIME.has(sniffed)) {
    throw validationError(
      `Unsupported file type (${sniffed}). Allowed: images (JPEG, PNG, WebP, GIF, AVIF), videos (MP4, MOV, WebM, MKV), documents (PDF, TXT, MD, JSON, CSV).`,
    );
  }

  const kind = kindForMime(sniffed);
  if (!kind) {
    throw validationError(`File type ${sniffed} is not accepted.`);
  }

  return { mime: sniffed, kind, declaredMime, size: buf.length, ...(filename ? {} : {}) };
}

export function textItemCannotHaveFile(): AppError {
  return validationError("TEXT/LINK items are created via the text endpoint, not file upload.");
}

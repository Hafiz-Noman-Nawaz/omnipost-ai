import { LocalStorageAdapter } from "@omnipost/media";

/**
 * Server-side storage singleton (docs/05 §3 STORAGE_*).
 * The adapter root lives outside git; keys are what the DB stores.
 */
const globalForMedia = globalThis as unknown as { storage?: LocalStorageAdapter };

export const storage: LocalStorageAdapter =
  globalForMedia.storage ??
  new LocalStorageAdapter(process.env.STORAGE_LOCAL_DIR ?? "./.data/uploads");

if (process.env.NODE_ENV !== "production") {
  globalForMedia.storage = storage;
}

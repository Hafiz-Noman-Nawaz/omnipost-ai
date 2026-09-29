import { NextResponse } from "next/server";
import { LocalStorageAdapter, validateUpload } from "@omnipost/media";
import { createContent, findDuplicateByHash, writeAudit } from "@omnipost/database";
import { AppError, validationError } from "@omnipost/shared";
import { fail, ok, requireApiRole } from "@/lib/api";
import { storage } from "@/lib/media";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Bulk upload (spec §7): multipart/form-data with one or more `files`,
 * optional `campaignId` and `tags` (comma-separated). Each file is
 * magic-byte validated, stored under a randomized org-scoped key, and
 * recorded as READY content.
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");

    const form = await req.formData().catch(() => {
      throw validationError("Expected multipart/form-data with a `files` field.");
    });

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      throw validationError("No files were provided.");
    }
    if (files.length > 50) {
      throw validationError("Upload at most 50 files per request.");
    }

    const campaignIdRaw = form.get("campaignId");
    const campaignId = typeof campaignIdRaw === "string" && campaignIdRaw ? campaignIdRaw : null;
    const tagsRaw = form.get("tags");
    const tags =
      typeof tagsRaw === "string" && tagsRaw.trim()
        ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20)
        : [];

    const created: Array<Record<string, unknown>> = [];
    const duplicates: Array<{ filename: string; existingId: string; existingTitle: string }> = [];
    const failed: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const verdict = validateUpload(buf, file.type || "application/octet-stream", file.name);

        const hash = LocalStorageAdapter.etag(buf);
        const dup = await findDuplicateByHash(ctx.organizationId, hash);
        if (dup) {
          duplicates.push({ filename: file.name, existingId: dup.id, existingTitle: dup.title });
          continue;
        }

        const stored = await storage.put({
          organizationId: ctx.organizationId,
          originalFilename: file.name,
          mimeType: verdict.mime,
          body: buf,
        });

        const item = await createContent({
          organizationId: ctx.organizationId,
          createdById: ctx.user.id,
          type: verdict.kind,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 180) || file.name,
          originalFilename: file.name,
          mimeType: verdict.mime,
          sizeBytes: stored.size,
          storageKey: stored.key,
          sourceHash: hash,
          tags,
          campaignId,
          status: "READY",
        });

        created.push({
          id: item.id,
          title: item.title,
          type: item.type,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          fileUrl: `/api/rest/content/${item.id}/file`,
        });
      } catch (err) {
        failed.push({
          filename: file.name,
          error: err instanceof Error ? err.message : "Upload failed.",
        });
      }
    }

    if (created.length > 0) {
      await writeAudit(ctx.organizationId, {
        actorType: "USER",
        actorId: ctx.user.id,
        action: "content.uploaded",
        resourceType: "content",
        resourceId: created.map((c) => String(c.id)).join(","),
        metadata: { count: created.length, duplicates: duplicates.length, failed: failed.length },
      });
    }

    const status = created.length > 0 ? 201 : failed.length > 0 ? 400 : 409;
    return NextResponse.json(
      { data: { created, duplicates, failed }, meta: { requested: files.length } },
      { status },
    );
  } catch (err) {
    return fail(err);
  }
}

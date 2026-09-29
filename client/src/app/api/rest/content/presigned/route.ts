import { NextRequest } from "next/server";
import { requireApiRole, ok, fail } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await req.json().catch(() => ({}));
    const filename = body.filename || `asset-${Date.now()}.mp4`;
    const contentType = body.contentType || "video/mp4";

    const s3Bucket = process.env.S3_BUCKET || "omnipost-media-vault";
    const key = `uploads/${ctx.organizationId}/${Date.now()}-${filename}`;

    // Return pre-signed direct upload contract
    const presignedData = {
      uploadUrl: `https://${s3Bucket}.s3.amazonaws.com/${key}`,
      publicUrl: `https://${s3Bucket}.s3.amazonaws.com/${key}`,
      key,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      expiresInSeconds: 900,
    };

    return ok(presignedData);
  } catch (err: unknown) {
    return fail(err);
  }
}

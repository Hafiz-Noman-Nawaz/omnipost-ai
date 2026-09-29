import { NextRequest } from "next/server";
import { requireApiRole, ok, fail } from "@/lib/api";
import { generateABVariants } from "@omnipost/ai";

export async function POST(req: NextRequest) {
  try {
    await requireApiRole("EDITOR");
    const body = await req.json().catch(() => ({}));
    if (!body.caption) {
      throw new Error("Base post caption is required for variant generation");
    }
    const variants = generateABVariants(body.caption, body.hashtags || []);
    return ok(variants);
  } catch (err: unknown) {
    return fail(err);
  }
}

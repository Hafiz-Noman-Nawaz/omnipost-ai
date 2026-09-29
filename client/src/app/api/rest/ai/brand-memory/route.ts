import { NextRequest } from "next/server";
import { requireApiRole, ok, fail } from "@/lib/api";
import { getBrandKnowledge, addBrandGuideline, searchBrandMemory } from "@omnipost/ai";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    const entries = q
      ? searchBrandMemory(ctx.organizationId, q)
      : getBrandKnowledge(ctx.organizationId);

    return ok(entries);
  } catch (err: unknown) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const body = await req.json().catch(() => ({}));

    if (!body.title || !body.content || !body.category) {
      throw new Error("title, content, and category are required");
    }

    const created = addBrandGuideline(ctx.organizationId, {
      category: body.category,
      title: body.title,
      content: body.content,
      tags: body.tags || [],
    });

    return ok(created);
  } catch (err: unknown) {
    return fail(err);
  }
}

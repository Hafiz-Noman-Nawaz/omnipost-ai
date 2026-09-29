import {
  listResponseTemplates,
  createResponseTemplate,
} from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { searchParams } = new URL(req.url);

    const intent = searchParams.get("intent") || undefined;
    const activeParam = searchParams.get("active");
    const active =
      activeParam === "true" ? true : activeParam === "false" ? false : undefined;
    const search = searchParams.get("search") || undefined;

    const templates = await listResponseTemplates(ctx, { intent, active, search });
    return ok(templates);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await req.json();

    const template = await createResponseTemplate(ctx, {
      name: body.name,
      intent: body.intent,
      body: body.body,
      platforms: body.platforms,
      active: body.active,
    });

    return ok(template, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}

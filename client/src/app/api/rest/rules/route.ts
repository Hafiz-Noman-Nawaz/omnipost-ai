import {
  listAutomationRules,
  createAutomationRule,
} from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { searchParams } = new URL(req.url);

    const campaignId = searchParams.get("campaignId") || undefined;
    const action = searchParams.get("action") || undefined;
    const enabledParam = searchParams.get("enabled");
    const enabled =
      enabledParam === "true" ? true : enabledParam === "false" ? false : undefined;

    const rules = await listAutomationRules(ctx, { campaignId, action, enabled });
    return ok(rules);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const body = await req.json();

    const rule = await createAutomationRule(ctx, {
      name: body.name,
      campaignId: body.campaignId,
      priority: body.priority,
      matchIntent: body.matchIntent,
      matchSentiment: body.matchSentiment,
      action: body.action,
      templateId: body.templateId,
      requireApproval: body.requireApproval,
      enabled: body.enabled,
    });

    return ok(rule, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}

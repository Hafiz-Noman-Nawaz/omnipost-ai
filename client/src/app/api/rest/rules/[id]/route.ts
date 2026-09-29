import {
  getAutomationRuleById,
  updateAutomationRule,
  deleteAutomationRule,
} from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const rule = await getAutomationRuleById(ctx, id);
    return ok(rule);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const { id } = await params;
    const body = await req.json();

    const updated = await updateAutomationRule(ctx, id, {
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

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const { id } = await params;
    const result = await deleteAutomationRule(ctx, id);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

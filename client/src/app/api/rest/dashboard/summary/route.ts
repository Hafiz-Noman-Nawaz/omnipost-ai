import { prisma } from "@omnipost/database";
import { fail, ok, requireApiSession } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Dashboard widgets (spec §24). Phase 1 returns real counts for what exists
 * (approvals/platforms arrive in later phases); absent widgets report
 * phase-pending rather than fake zeros.
 */
export async function GET() {
  try {
    const ctx = await requireApiSession();
    const orgId = ctx.organizationId;

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });

    return ok({
      widgets: {
        todaysPosts: { value: 0, available: false, phase: 6 },
        pendingApproval: { value: 0, available: false, phase: 5 },
        scheduledPosts: { value: 0, available: false, phase: 6 },
        publishedPosts: { value: 0, available: false, phase: 6 },
        failedPosts: { value: 0, available: false, phase: 6 },
        comments: { value: 0, available: false, phase: 9 },
        attentionRequired: { value: 0, available: false, phase: 9 },
      },
      organization: {
        id: orgId,
        timezone: settings?.timezone ?? "UTC",
        autoReplyMaster: settings?.autoReplyMaster ?? false,
      },
      user: ctx.user,
    });
  } catch (err) {
    return fail(err);
  }
}

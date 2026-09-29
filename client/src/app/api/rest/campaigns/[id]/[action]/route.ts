import { pauseCampaign, resumeCampaign, writeAudit } from "@omnipost/database";
import type { CampaignStatus } from "@omnipost/database";
import { conflict } from "@omnipost/shared";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; action: string }> };

const ACTIONS = {
  pause: { to: "PAUSED", via: pauseCampaign },
  resume: { to: "ACTIVE", via: resumeCampaign },
} as const;

export async function POST(_req: Request, { params }: Params) {
  try {
    // Pause/resume change automation behavior (docs/03): ADMIN only.
    const ctx = await requireApiRole("ADMIN");
    const { id, action } = await params;

    const def = ACTIONS[action as keyof typeof ACTIONS];
    if (!def) {
      throw conflict(`Unknown campaign action "${action}". Use pause or resume.`);
    }

    const campaign = await def.via(ctx.organizationId, id);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: `campaign.${action}`,
      resourceType: "campaign",
      resourceId: id,
      metadata: { to: def.to as CampaignStatus },
    });

    return ok(campaign);
  } catch (err) {
    return fail(err);
  }
}

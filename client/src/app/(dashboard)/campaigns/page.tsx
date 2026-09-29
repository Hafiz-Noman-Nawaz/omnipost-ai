import { requireSession } from "@/lib/session";
import CampaignManager from "@/components/CampaignManager";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const { context } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Campaigns</h1>
        <p className="muted text-sm mt-1">
          Objectives, audiences, tone and CTAs per push — the context the AI agent uses to
          generate and schedule posts in later phases.
        </p>
      </div>
      <CampaignManager role={context.user.role} />
    </div>
  );
}

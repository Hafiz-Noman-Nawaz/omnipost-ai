import ApprovalQueue from "@/components/ApprovalQueue";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <ApprovalQueue />
    </div>
  );
}

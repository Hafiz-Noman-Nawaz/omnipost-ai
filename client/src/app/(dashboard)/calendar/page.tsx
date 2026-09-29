import CalendarManager from "@/components/CalendarManager";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <CalendarManager />
    </div>
  );
}

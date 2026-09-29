import { requireSession } from "@/lib/session";
import ResponsiveLayout from "@/components/ResponsiveLayout";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { context } = await requireSession();

  return (
    <ResponsiveLayout user={context.user}>
      {children}
    </ResponsiveLayout>
  );
}

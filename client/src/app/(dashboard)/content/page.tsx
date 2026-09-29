import { requireSession } from "@/lib/session";
import ContentLibrary from "@/components/ContentLibrary";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Content</h1>
        <p className="muted text-sm mt-1">
          The vault: upload once, reuse everywhere. Files are stored privately — access is
          authenticated and org-scoped.
        </p>
      </div>
      <ContentLibrary />
    </div>
  );
}

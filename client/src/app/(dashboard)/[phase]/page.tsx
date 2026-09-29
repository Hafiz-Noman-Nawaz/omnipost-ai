import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const LABELS: Record<string, { title: string; phase: number; blurb: string }> = {
  analytics: { title: "Analytics", phase: 11, blurb: "Honest metrics: available, unavailable, pending." },
  agent: { title: "AI Agent", phase: 12, blurb: "Natural-language control through permission-gated tools." },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LABELS).map((phase) => ({ phase }));
}

export default async function PhasePlaceholderPage({
  params,
}: {
  params: Promise<{ phase: string }>;
}) {
  const { phase } = await params;
  await requireSession();
  const info = LABELS[phase] ?? { title: "Coming soon", phase: 0, blurb: "" };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">{info.title}</h1>
        <p className="muted text-sm mt-1">{info.blurb}</p>
      </div>
      <div className="card">
        <p className="text-sm">
          This area ships in <strong>Phase {info.phase}</strong> of the build plan
          (see <code>docs/05 §5</code>). The navigation and shell are live now so the
          product structure is visible end-to-end.
        </p>
      </div>
    </div>
  );
}

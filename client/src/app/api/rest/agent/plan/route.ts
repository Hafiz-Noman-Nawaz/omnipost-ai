import { runAgent, selectLLMProvider } from "@omnipost/ai";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    let body: { goal?: string; trigger?: "AUTONOMOUS_PLANNING" | "DAILY_REPORT" } = {};

    try {
      body = await req.json();
    } catch {
      // Optional body
    }

    const { provider: llm } = selectLLMProvider();

    const prompt = body.goal
      ? `Execute autonomous strategic planning cycle for goal: "${body.goal}". Check existing campaigns, retrieve recent analytics performance, and draft corresponding social content.`
      : "Execute autonomous daily operational scan: check 7-day analytics performance, inspect unmoderated audience comments, check calendar schedule, and draft a high-impact post.";

    const result = await runAgent(llm, {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      userRole: ctx.user.role as any,
      userMessage: prompt,
      trigger: body.trigger || "AUTONOMOUS_PLANNING",
    });

    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

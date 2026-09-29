import { runAgent, selectLLMProvider } from "@omnipost/ai";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const body = await req.json();

    if (!body.message || typeof body.message !== "string") {
      throw new Error("Message is required for agent interaction");
    }

    const { provider: llm } = selectLLMProvider();

    const result = await runAgent(llm, {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      userRole: ctx.user.role as any,
      userMessage: body.message,
      trigger: body.trigger || "CHAT",
      confirmedToolCallId: body.confirmedToolCallId || null,
    });

    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

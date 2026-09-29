import { confirmAgentToolCall } from "@omnipost/database";
import { getToolByName, AgentExecutionContext } from "@omnipost/ai";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const body = await req.json();

    if (!body.toolCallId || !body.action) {
      throw new Error("toolCallId and action (APPROVE | REJECT) are required");
    }

    if (body.action !== "APPROVE" && body.action !== "REJECT") {
      throw new Error("action must be APPROVE or REJECT");
    }

    const { toolCall, status } = await confirmAgentToolCall(ctx, body.toolCallId, body.action);

    let executionResult: any = null;
    if (body.action === "APPROVE") {
      const tool = getToolByName(toolCall.toolName);
      if (tool) {
        const execCtx: AgentExecutionContext = {
          organizationId: ctx.organizationId,
          userId: ctx.user.id,
          userRole: ctx.user.role as any,
          executionId: toolCall.executionId,
          confirmedToolCallId: toolCall.id,
        };
        try {
          executionResult = await tool.execute(toolCall.args as any, execCtx);
        } catch (err: any) {
          executionResult = { error: err?.message || String(err) };
        }
      }
    }

    return ok({
      toolCallId: body.toolCallId,
      status,
      executionResult,
    });
  } catch (err) {
    return fail(err);
  }
}

import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma,
  createAgentExecution,
  recordAgentToolCall,
  confirmAgentToolCall,
  listAgentExecutions,
  getAgentExecutionById,
  saveCampaignMemory,
  listCampaignMemories,
  type SessionContext,
} from "../src";

describe("Phase 12 Agent Database Repos & Confirmation Protocol", () => {
  let mockContext: SessionContext;
  let testExecutionId: string;
  let testToolCallId: string;
  let testCampaignId: string;

  beforeAll(async () => {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Agent Test Org", slug: `test-org-agent-${Date.now()}` },
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `agent-tester-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          name: "Agent Tester",
        },
      });
      await prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "ADMIN",
        },
      });
    }

    mockContext = {
      user: { id: user.id, email: user.email, role: "ADMIN", name: "Agent Tester" },
      organizationId: org.id,
    };

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: org.id,
        name: "Agent Test Campaign",
        status: "ACTIVE",
      },
    });
    testCampaignId = campaign.id;
  });

  it("creates agent execution record with prompt injection flags", async () => {
    const exec = await createAgentExecution(mockContext, {
      trigger: "CHAT",
      model: "omnipost-agent-v1",
      input: "Review recent comments and suggest replies",
      promptInjectionFlags: [],
    });

    expect(exec.id).toBeDefined();
    expect(exec.status).toBe("running");
    expect(exec.input).toBe("Review recent comments and suggest replies");
    testExecutionId = exec.id;
  });

  it("records agent tool calls with risk class and denial tracking", async () => {
    const toolCall = await recordAgentToolCall(mockContext, {
      executionId: testExecutionId,
      toolName: "publish_post",
      args: { postId: "sample_post_1" },
      riskClass: "HIGH_RISK",
      allowed: false,
      denialReason: "Pending administrator confirmation token",
      resultSummary: "Blocked: Pending administrator confirmation.",
    });

    expect(toolCall.id).toBeDefined();
    expect(toolCall.executionId).toBe(testExecutionId);
    expect(toolCall.riskClass).toBe("HIGH_RISK");
    expect(toolCall.allowed).toBe(false);
    testToolCallId = toolCall.id;
  });

  it("handles administrator confirmation (APPROVE and REJECT)", async () => {
    const confirmed = await confirmAgentToolCall(mockContext, testToolCallId, "APPROVE");

    expect(confirmed.status).toBe("APPROVE");
    expect(confirmed.toolCall.allowed).toBe(true);

    const exec = await getAgentExecutionById(mockContext, testExecutionId);
    expect(exec.status).toBe("completed");
  });

  it("lists agent executions with pagination", async () => {
    const list = await listAgentExecutions(mockContext, { limit: 10 });

    expect(list.items.length).toBeGreaterThanOrEqual(1);
    expect(list.total).toBeGreaterThanOrEqual(1);
    expect(list.items[0].toolCalls).toBeInstanceOf(Array);
  });

  it("saves and retrieves campaign memory", async () => {
    const mem = await saveCampaignMemory(
      mockContext,
      testCampaignId,
      "performance_note",
      "Short form video generated 40% higher engagement than image posts"
    );

    expect(mem.id).toBeDefined();
    expect(mem.campaignId).toBe(testCampaignId);

    const list = await listCampaignMemories(mockContext, testCampaignId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].content).toContain("40% higher engagement");
  });
});

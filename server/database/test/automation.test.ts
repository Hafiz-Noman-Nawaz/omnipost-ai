import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma,
  upsertComment,
  createResponseTemplate,
  listResponseTemplates,
  updateResponseTemplate,
  deleteResponseTemplate,
  createAutomationRule,
  listAutomationRules,
  updateAutomationRule,
  reorderAutomationRules,
  deleteAutomationRule,
  evaluateCommentAutomation,
  updateSettings,
  CommentIntent,
  AutomationAction,
  CommentStatus,
  type SessionContext,
} from "../src";

describe("Phase 10 Response Library, Automation Rules, & Kill-Switch", () => {
  let mockContext: SessionContext;
  let testPostId: string;

  beforeAll(async () => {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Test Org Automation", slug: `test-org-auto-${Date.now()}` },
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `auto-tester-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          name: "Automation Tester",
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
      user: { id: user.id, email: user.email, role: "ADMIN", name: "Automation Tester" },
      organizationId: org.id,
    };

    // Ensure test post exists
    let content = await prisma.content.findFirst({
      where: { organizationId: org.id },
    });
    if (!content) {
      content = await prisma.content.create({
        data: {
          organizationId: org.id,
          title: "OmniDesk Smart Organizer",
          type: "IMAGE",
          status: "PUBLISHED",
        },
      });
    }

    const post = await prisma.post.create({
      data: {
        organizationId: org.id,
        contentId: content.id,
        platform: "INSTAGRAM",
        caption: "Supercharge your desk setup with OmniDesk! Link in bio.",
        linkUrl: "https://omnipost.local/omnidesk",
        status: "PUBLISHED",
      },
    });
    testPostId = post.id;
  });

  it("should enforce allowed variable validation when creating response templates", async () => {
    // Invalid variable
    await expect(
      createResponseTemplate(mockContext, {
        name: "Invalid Template",
        intent: CommentIntent.QUESTION,
        body: "Hello {{unsupported_variable}}! Check our link.",
      })
    ).rejects.toThrow(/Invalid template variables/);

    // Valid template
    const template = await createResponseTemplate(mockContext, {
      name: "Product Inquiry Reply",
      intent: CommentIntent.QUESTION,
      body: "Hi {{author}}! Thanks for asking about {{product}}. Check details at {{link}}.",
      platforms: ["INSTAGRAM", "X"],
    });

    expect(template).toBeDefined();
    expect(template.id).toBeTruthy();
    expect(template.name).toBe("Product Inquiry Reply");

    // List templates
    const templates = await listResponseTemplates(mockContext);
    expect(templates.some((t) => t.id === template.id)).toBe(true);
  });

  it("should manage automation rules and reorder priorities", async () => {
    const tpl = await createResponseTemplate(mockContext, {
      name: "General Pricing Reply",
      intent: CommentIntent.PRICING,
      body: "Hi {{author}}, our prices start at {{price}}! See {{link}}.",
    });

    const rule1 = await createAutomationRule(mockContext, {
      name: "Auto-reply to Pricing Questions",
      priority: 20,
      matchIntent: CommentIntent.PRICING,
      action: AutomationAction.AUTO_REPLY,
      templateId: tpl.id,
    });

    const rule2 = await createAutomationRule(mockContext, {
      name: "Escalate Complaints Immediately",
      priority: 10,
      matchIntent: CommentIntent.COMPLAINT,
      action: AutomationAction.ESCALATE,
    });

    expect(rule1.id).toBeTruthy();
    expect(rule2.id).toBeTruthy();

    const rules = await listAutomationRules(mockContext);
    expect(rules.length).toBeGreaterThanOrEqual(2);
    // rule2 has priority 10, rule1 has priority 20
    const r2Index = rules.findIndex((r) => r.id === rule2.id);
    const r1Index = rules.findIndex((r) => r.id === rule1.id);
    expect(r2Index).toBeLessThan(r1Index);

    // Reorder
    await reorderAutomationRules(mockContext, [rule1.id, rule2.id]);
    const reordered = await listAutomationRules(mockContext);
    const updatedR1 = reordered.find((r) => r.id === rule1.id);
    const updatedR2 = reordered.find((r) => r.id === rule2.id);
    expect(updatedR1!.priority).toBeLessThan(updatedR2!.priority);
  });

  it("should never auto-reply to toxic/abuse comments, even if an auto-reply rule matches", async () => {
    // Create an auto-reply template and matching rule for negative comments
    const apologyTpl = await createResponseTemplate(mockContext, {
      name: "Catchall Auto Reply",
      intent: CommentIntent.GENERAL,
      body: "Hello {{author}}, thank you for commenting.",
    });

    await createAutomationRule(mockContext, {
      name: "Catchall Negative Auto Reply",
      priority: 1,
      matchSentiment: "NEGATIVE",
      action: AutomationAction.AUTO_REPLY,
      templateId: apologyTpl.id,
    });

    // Create an abuse comment
    const abuseComment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_abuse_${Date.now()}`,
      authorName: "troll_user",
      text: "You scammers are the worst garbage ever!",
    });

    await prisma.comment.update({
      where: { id: abuseComment.id },
      data: {
        intent: CommentIntent.ABUSE,
        sentiment: "NEGATIVE",
        safetyFlags: ["toxic_language"],
      },
    });

    const result = await evaluateCommentAutomation(mockContext, abuseComment.id);
    expect(result.actionTaken).toBe("ESCALATED");
    expect(result.reason).toContain("blocked");
  });

  it("should block auto-reply when Master Kill-Switch is OFF and queue as suggestion", async () => {
    // Ensure kill-switch is OFF
    await updateSettings(mockContext.organizationId, { autoReplyMaster: false });

    const pricingTpl = await createResponseTemplate(mockContext, {
      name: "Auto Pricing Response",
      intent: CommentIntent.PRICING,
      body: "Hi {{author}}! Get {{product}} at {{link}}.",
    });

    await createAutomationRule(mockContext, {
      name: "Pricing Auto Rule",
      priority: 5,
      matchIntent: CommentIntent.PRICING,
      action: AutomationAction.AUTO_REPLY,
      templateId: pricingTpl.id,
    });

    const comment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_pricing_${Date.now()}`,
      authorName: "buyer_bob",
      text: "How much is this desk organizer?",
    });

    await prisma.comment.update({
      where: { id: comment.id },
      data: {
        intent: CommentIntent.PRICING,
        sentiment: "NEUTRAL",
      },
    });

    const result = await evaluateCommentAutomation(mockContext, comment.id);
    expect(result.actionTaken).toBe("BLOCKED_BY_KILL_SWITCH");
    expect(result.replyText).toContain("buyer_bob");

    const updatedComment = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(updatedComment?.status).toBe(CommentStatus.ACTION_PENDING);
  });

  it("should execute auto-reply when Master Kill-Switch is ON", async () => {
    // Turn kill-switch ON
    await updateSettings(mockContext.organizationId, { autoReplyMaster: true });

    const comment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_live_reply_${Date.now()}`,
      authorName: "alice_shopper",
      text: "Is there a discount on OmniDesk?",
    });

    await prisma.comment.update({
      where: { id: comment.id },
      data: {
        intent: CommentIntent.PRICING,
        sentiment: "NEUTRAL",
      },
    });

    const result = await evaluateCommentAutomation(mockContext, comment.id);
    expect(result.actionTaken).toBe("AUTO_REPLIED");
    expect(result.replyText).toContain("alice_shopper");

    const updatedComment = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(updatedComment?.status).toBe(CommentStatus.HANDLED);
    expect(updatedComment?.repliedAt).toBeDefined();

    // Reset kill-switch to OFF (safe default)
    await updateSettings(mockContext.organizationId, { autoReplyMaster: false });
  });
});

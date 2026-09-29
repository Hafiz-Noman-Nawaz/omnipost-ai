import { prisma } from "../client";
import { notFound, validationError } from "@omnipost/shared";
import { isPlatformKey } from "@omnipost/shared";
import type { PlatformKey } from "@omnipost/shared";
import {
  CAPTION_PROMPT,
  CAPTION_OUTPUT_SCHEMA,
  enforceDisclosure,
  screenCaption,
  LLMError,
  selectLLMProvider,
} from "@omnipost/ai";
import type { CaptionOutput, SafetyFlag } from "@omnipost/ai";

/**
 * Content variants (docs/02 ContentVariant, docs/03 "generate" endpoint).
 * Generation assembles context from the content item + its campaign + brand,
 * calls the LLM port once per platform, applies the output firewall
 * (docs/04 §6.5), and upserts one variant per (content, platform).
 */

export interface VariantRow {
  id: string;
  contentId: string;
  organizationId: string;
  platform: string;
  caption: string;
  hashtags: string[];
  hook: string | null;
  cta: string | null;
  model: string | null;
  promptVersion: string | null;
  safetyFlags: { ok: boolean; flags: SafetyFlag[] } | null;
  approved: boolean | null;
  createdAt: Date;
}

export interface GenerateResult {
  platform: PlatformKey;
  status: "created" | "updated" | "failed";
  flags: SafetyFlag[];
  error?: string;
}

export interface GenerateVariantsResult {
  contentId: string;
  model: string;
  provider: string;
  promptVersion: string;
  isMock: boolean;
  results: GenerateResult[];
}

export async function getVariantById(organizationId: string, id: string) {
  const variant = await prisma.contentVariant.findUnique({ where: { id } });
  if (!variant || variant.organizationId !== organizationId) return null;
  return variant;
}

export async function listVariantsForContent(organizationId: string, contentId: string) {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content || content.organizationId !== organizationId) throw notFound("Content");
  return prisma.contentVariant.findMany({
    where: { contentId, organizationId },
    orderBy: { createdAt: "desc" },
  });
}

/** The content's org must own any campaign attached to it — checked at write time upstream. */
async function loadContext(organizationId: string, contentId: string) {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      campaign: {
        include: { brand: true },
      },
    },
  });
  if (!content || content.organizationId !== organizationId) throw notFound("Content");

  const brand = content.campaign?.brand
    ? {
        name: content.campaign.brand.name,
        voice: content.campaign.brand.voice,
        avoid: content.campaign.brand.avoid,
        audience: content.campaign.brand.audience,
      }
    : null;

  const campaign = content.campaign
    ? {
        name: content.campaign.name,
        objective: content.campaign.objective,
        targetAudience: content.campaign.targetAudience,
        tone: content.campaign.tone,
        brandVoice: content.campaign.brandVoice,
        cta: content.campaign.cta,
        landingUrl: content.campaign.landingUrl,
      }
    : null;

  return { content, campaign, brand };
}

/** Avoid-terms come from Brand.avoid ("corporate language, fake urgency" style lists). */
function parseAvoidTerms(avoid: string | null | undefined): string[] {
  if (!avoid) return [];
  return avoid
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

/** Guardrails gate *approval*, never storage — flagged variants stay visible. */
async function upsertVariant(args: {
  contentId: string;
  organizationId: string;
  platform: PlatformKey;
  output: CaptionOutput;
  model: string;
  promptVersion: string;
  safety: { ok: boolean; flags: SafetyFlag[] };
}) {
  const { contentId, organizationId, platform, output, model, promptVersion, safety } = args;
  const data = {
    caption: output.caption,
    hashtags: output.hashtags,
    hook: output.hook ?? null,
    cta: output.cta ?? null,
    model,
    promptVersion,
    safetyFlags: safety as unknown as never,
    approved: safety.ok ? null : false, // flagged => explicitly rejected-for-now; clean => awaiting human
  };
  return prisma.contentVariant.upsert({
    where: { contentId_platform: { contentId, platform } },
    create: { contentId, organizationId, platform, ...data },
    update: data,
  });
}

export interface GenerateVariantsInput {
  organizationId: string;
  contentId: string;
  platforms: PlatformKey[];
}

export async function generateVariants(input: GenerateVariantsInput): Promise<GenerateVariantsResult> {
  if (input.platforms.length === 0) {
    throw validationError("Provide at least one platform to generate for.");
  }
  for (const p of input.platforms) {
    if (!isPlatformKey(p)) throw validationError(`Unknown platform "${p}".`);
  }

  const { content, campaign, brand } = await loadContext(input.organizationId, input.contentId);

  if (content.type === "IMAGE" || content.type === "VIDEO" || content.type === "DOCUMENT") {
    // Media captions are allowed, but there must be *some* textual context.
    if (!content.title && !content.description) {
      throw validationError("This item has no text to write from — add a title or description first.");
    }
  }

  const { provider, isMock } = selectLLMProvider();
  const prompt = CAPTION_PROMPT;
  const avoidTerms = parseAvoidTerms(brand?.avoid);
  const disclosure = campaign?.name ? (content.campaign?.disclosureText ?? null) : null;

  const results: GenerateResult[] = [];
  for (const platform of input.platforms) {
    try {
      const userPrompt = prompt.buildUser({
        platform,
        title: content.title,
        description: content.description,
        text: content.text,
        contentType: content.type,
        campaign,
        brand,
        disclosureText: disclosure,
      });

      const completion = await provider.complete({
        system: prompt.system,
        user: userPrompt,
        outputSchema: CAPTION_OUTPUT_SCHEMA,
        maxTokens: 700,
        temperature: 0.7,
      });

      let output = completion.output as CaptionOutput;
      output = enforceDisclosure(output, disclosure);
      const safety = screenCaption(platform, output, { avoidTerms, disclosureText: disclosure });

      const variant = await upsertVariant({
        contentId: content.id,
        organizationId: input.organizationId,
        platform,
        output,
        model: completion.model,
        promptVersion: prompt.version,
        safety,
      });

      // Synchronize to Post table for the approval workflow (spec §11)
      const postStatus = safety.ok ? "AWAITING_APPROVAL" : "AI_GENERATED";
      const existingPost = await prisma.post.findFirst({
        where: {
          organizationId: input.organizationId,
          contentId: content.id,
          platform,
        },
      });

      if (existingPost) {
        await prisma.post.update({
          where: { id: existingPost.id },
          data: {
            caption: output.caption,
            hashtags: output.hashtags,
            safetyFlags: safety as unknown as never,
            status: existingPost.status === "APPROVED" ? "APPROVED" : postStatus,
            variantId: variant.id,
          },
        });
      } else {
        await prisma.post.create({
          data: {
            organizationId: input.organizationId,
            contentId: content.id,
            campaignId: content.campaignId,
            platform,
            caption: output.caption,
            hashtags: output.hashtags,
            linkUrl: campaign?.landingUrl ?? null,
            mediaStorageKeys: content.storageKey ? [content.storageKey] : [],
            safetyFlags: safety as unknown as never,
            status: postStatus,
            variantId: variant.id,
          },
        });
      }

      results.push({ platform, status: "created", flags: safety.flags });
    } catch (e) {
      const message = e instanceof LLMError ? `AI provider error: ${e.message}` : (e as Error).message;
      results.push({ platform, status: "failed", flags: [], error: message });
    }
  }

  return {
    contentId: content.id,
    model: provider.model,
    provider: provider.id,
    promptVersion: prompt.version,
    isMock,
    results,
  };
}

/** Approval workflow: flagged variants can only be approved explicitly by a human here. */
export async function setVariantApproval(organizationId: string, id: string, approved: boolean) {
  const variant = await getVariantById(organizationId, id);
  if (!variant) throw notFound("Variant");

  const safety = variant.safetyFlags as { ok: boolean; flags: SafetyFlag[] } | null;
  if (approved && safety && !safety.ok) {
    throw validationError(
      "This variant failed safety checks and cannot be approved. Regenerate or edit the content first.",
    );
  }

  return prisma.contentVariant.update({
    where: { id },
    data: { approved },
  });
}

export interface UpdateVariantInput {
  caption?: string;
  hook?: string | null;
  cta?: string | null;
  hashtags?: string[];
  approved?: boolean | null;
}

export async function updateVariant(organizationId: string, id: string, input: UpdateVariantInput) {
  const variant = await getVariantById(organizationId, id);
  if (!variant) throw notFound("Variant");

  if (input.approved === true) {
    const safety = variant.safetyFlags as { ok: boolean; flags: SafetyFlag[] } | null;
    if (safety && !safety.ok) {
      throw validationError(
        "This variant failed safety checks and cannot be approved. Regenerate or edit the content first.",
      );
    }
  }

  return prisma.contentVariant.update({
    where: { id },
    data: {
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      ...(input.hook !== undefined ? { hook: input.hook } : {}),
      ...(input.cta !== undefined ? { cta: input.cta } : {}),
      ...(input.hashtags !== undefined ? { hashtags: input.hashtags } : {}),
      ...(input.approved !== undefined ? { approved: input.approved } : {}),
    },
  });
}

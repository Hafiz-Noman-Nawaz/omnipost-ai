export interface BrandGuidelineEntry {
  id: string;
  organizationId: string;
  category: "TONE" | "VALUE_PROP" | "STYLE_RULE" | "PROHIBITED_TERM" | "FEW_SHOT_EXAMPLE";
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
}

// In-memory knowledge store with initial brand defaults per organization
const brandKnowledgeStore = new Map<string, BrandGuidelineEntry[]>();

export function getBrandKnowledge(organizationId: string): BrandGuidelineEntry[] {
  let entries = brandKnowledgeStore.get(organizationId);
  if (!entries) {
    entries = [
      {
        id: "bg-1",
        organizationId,
        category: "TONE",
        title: "Voice & Tone",
        content: "Authoritative yet approachable, concise, data-driven, and forward-looking.",
        tags: ["tone", "voice"],
        createdAt: new Date().toISOString(),
      },
      {
        id: "bg-2",
        organizationId,
        category: "STYLE_RULE",
        title: "Formatting & Emojis",
        content: "Limit to 1-3 emojis per post; place hashtags at the bottom; never use ALL CAPS headlines.",
        tags: ["formatting", "style"],
        createdAt: new Date().toISOString(),
      },
      {
        id: "bg-3",
        organizationId,
        category: "PROHIBITED_TERM",
        title: "Banned Terminology",
        content: "Never guarantee financial gains, viral reach, or unverified performance claims.",
        tags: ["compliance", "safety"],
        createdAt: new Date().toISOString(),
      },
      {
        id: "bg-4",
        organizationId,
        category: "FEW_SHOT_EXAMPLE",
        title: "Top Converting LinkedIn Hook",
        content: "Most teams spend 14 hours/week formatting cross-platform content. Here is the exact system we used to cut that to 15 minutes:",
        tags: ["linkedin", "hook"],
        createdAt: new Date().toISOString(),
      },
    ];
    brandKnowledgeStore.set(organizationId, entries);
  }
  return entries;
}

export function addBrandGuideline(
  organizationId: string,
  entry: Omit<BrandGuidelineEntry, "id" | "organizationId" | "createdAt">
): BrandGuidelineEntry {
  const list = getBrandKnowledge(organizationId);
  const created: BrandGuidelineEntry = {
    id: `bg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    organizationId,
    ...entry,
    createdAt: new Date().toISOString(),
  };
  list.push(created);
  brandKnowledgeStore.set(organizationId, list);
  return created;
}

export function searchBrandMemory(organizationId: string, query: string): BrandGuidelineEntry[] {
  const all = getBrandKnowledge(organizationId);
  if (!query.trim()) return all;
  const q = query.toLowerCase();
  return all.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      (e.tags && e.tags.some((t) => t.toLowerCase().includes(q)))
  );
}

/** Formats relevant brand knowledge into prompt context string for agent LLM */
export function buildBrandContextPrompt(organizationId: string): string {
  const memory = getBrandKnowledge(organizationId);
  return `=== BRAND KNOWLEDGE & STYLE GUIDELINES ===
${memory.map((m) => `[${m.category}] ${m.title}: ${m.content}`).join("\n")}
==========================================`;
}

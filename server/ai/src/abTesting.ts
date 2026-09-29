export interface ABPostVariant {
  variantId: "A" | "B" | "C";
  angle: "Direct Value / Data-Driven" | "Curiosity & Storytelling" | "Contrarian / Problem-Agitate";
  headline: string;
  caption: string;
  hashtags: string[];
}

export function generateABVariants(baseCaption: string, baseHashtags: string[] = []): ABPostVariant[] {
  const lines = baseCaption.trim().split("\n");
  const coreBody = lines.slice(1).join("\n").trim() || lines[0];

  return [
    {
      variantId: "A",
      angle: "Direct Value / Data-Driven",
      headline: `How to scale your output without sacrificing brand quality:`,
      caption: `How to scale your output without sacrificing brand quality:\n\n${coreBody}`,
      hashtags: baseHashtags,
    },
    {
      variantId: "B",
      angle: "Curiosity & Storytelling",
      headline: `We tested a completely new approach to this last month...`,
      caption: `We tested a completely new approach to this last month, and the numbers surprised us.\n\n${coreBody}`,
      hashtags: baseHashtags,
    },
    {
      variantId: "C",
      angle: "Contrarian / Problem-Agitate",
      headline: `The standard advice on this is wrong.`,
      caption: `The standard advice on this is wrong.\n\nMost teams focus on volume, but here is what actually drives conversion:\n\n${coreBody}`,
      hashtags: baseHashtags,
    },
  ];
}

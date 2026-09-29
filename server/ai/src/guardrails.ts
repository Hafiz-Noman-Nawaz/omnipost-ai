import type { CaptionOutput } from "./prompts";

/**
 * Output firewall (docs/04 §6.5, spec §36/§37): generated captions pass these
 * regex/structural checks before they can be saved. Flagged output is stored
 * with safetyFlags and can only be approved by a human.
 */

export interface SafetyFlag {
  code: "BANNED_CLAIM" | "AVOID_TERM" | "DISCLOSURE_MISSING" | "TOO_LONG";
  message: string;
}

export interface SafetyResult {
  ok: boolean;
  flags: SafetyFlag[];
}

/** Per-platform max caption length (docs/04 §5 capability matrix; conservative). */
export const CAPTION_LIMITS: Record<string, number> = {
  X: 280,
  INSTAGRAM: 2200,
  FACEBOOK: 5000,
  LINKEDIN: 3000,
  TIKTOK: 2200,
  YOUTUBE: 5000,
};

/**
 * Banned-claims list (docs/05 §6): fabricated prices/specs/earnings/reviews.
 * Word-boundary regexes; intentionally broad — false positives only force
 * human review, which is the safe direction.
 */
const BANNED_PATTERNS: Array<{ re: RegExp; what: string }> = [
  { re: /\$\s?\d+([\.,]\d+)?/i, what: "price-like figure" },
  { re: /\b\d+\s?%\s?(off|discount)\b/i, what: "discount claim" },
  { re: /\b(guaranteed|risk[- ]free)\b/i, what: "guarantee claim" },
  { re: /\b(\d+x|ten\s?x)\s?(returns?|roi|earnings?)\b/i, what: "earnings claim" },
  { re: /\b(cure|heals?|medically proven)\b/i, what: "medical claim" },
  { re: /\b(5[- ]star|best)\s+(rated|reviews?)\b/i, what: "review claim" },
];

export function screenCaption(
  platform: string,
  output: CaptionOutput,
  opts: { avoidTerms?: string[]; disclosureText?: string | null } = {},
): SafetyResult {
  const flags: SafetyFlag[] = [];
  const full = [output.hook ?? "", output.caption, output.cta ?? ""].join("\n");

  for (const { re, what } of BANNED_PATTERNS) {
    const m = full.match(re);
    if (m) {
      flags.push({ code: "BANNED_CLAIM", message: `Possible ${what} detected: “${m[0]}” — needs human review.` });
    }
  }

  for (const term of opts.avoidTerms ?? []) {
    const t = term.trim();
    if (t.length >= 3 && full.toLowerCase().includes(t.toLowerCase())) {
      flags.push({ code: "AVOID_TERM", message: `Uses brand-avoid term: “${t}”.` });
    }
  }

  if (opts.disclosureText && !full.includes(opts.disclosureText)) {
    flags.push({
      code: "DISCLOSURE_MISSING",
      message: "Affiliate disclosure is missing from the caption — it must appear verbatim.",
    });
  }

  const limit = CAPTION_LIMITS[platform];
  if (limit && output.caption.length > limit) {
    flags.push({
      code: "TOO_LONG",
      message: `Caption is ${output.caption.length} chars; ${platform} allows ${limit}.`,
    });
  }

  return { ok: flags.length === 0, flags };
}

/** Append the campaign disclosure if the model dropped it (belt-and-braces). */
export function enforceDisclosure(output: CaptionOutput, disclosureText?: string | null): CaptionOutput {
  if (!disclosureText || output.caption.includes(disclosureText)) return output;
  return { ...output, caption: `${output.caption}\n\n${disclosureText}` };
}

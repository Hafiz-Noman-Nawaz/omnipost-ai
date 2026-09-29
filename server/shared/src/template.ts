export const ALLOWED_TEMPLATE_VARIABLES = [
  "brand",
  "product",
  "price",
  "link",
  "campaign",
  "author",
] as const;

export type AllowedTemplateVariable = (typeof ALLOWED_TEMPLATE_VARIABLES)[number];

const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export interface ValidationResult {
  valid: boolean;
  variables: string[];
  invalidVariables: string[];
}

/**
 * Validate that all {{variable}} placeholders in a response template
 * belong to the allowed whitelist (spec §18).
 */
export function validateTemplateVariables(template: string): ValidationResult {
  const matches = [...template.matchAll(VARIABLE_REGEX)];
  const variables = matches.map((m) => m[1]!);
  const uniqueVars = Array.from(new Set(variables));

  const invalidVariables = uniqueVars.filter(
    (v) => !ALLOWED_TEMPLATE_VARIABLES.includes(v as AllowedTemplateVariable)
  );

  return {
    valid: invalidVariables.length === 0,
    variables: uniqueVars,
    invalidVariables,
  };
}

/**
 * Interpolate values into template string, falling back to empty string or default.
 */
export function interpolateTemplate(
  template: string,
  values: Partial<Record<AllowedTemplateVariable | string, string | null | undefined>>
): string {
  return template.replace(VARIABLE_REGEX, (_match, varName) => {
    const val = values[varName];
    if (val !== undefined && val !== null) {
      return String(val);
    }
    return "";
  });
}

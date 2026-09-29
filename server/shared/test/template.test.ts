import { describe, it, expect } from "vitest";
import {
  validateTemplateVariables,
  interpolateTemplate,
  ALLOWED_TEMPLATE_VARIABLES,
} from "../src/template";

describe("Phase 10 Template Validation & Variable Interpolation", () => {
  it("should validate allowed template variables successfully", () => {
    const validTpl = "Hi {{author}}! Check out {{product}} at {{link}} from {{brand}}.";
    const result = validateTemplateVariables(validTpl);
    expect(result.valid).toBe(true);
    expect(result.variables).toEqual(["author", "product", "link", "brand"]);
    expect(result.invalidVariables).toHaveLength(0);
  });

  it("should reject disallowed or malformed variables", () => {
    const invalidTpl = "Hello {{user_credit_card}}, your discount is {{secret_code}} on {{product}}.";
    const result = validateTemplateVariables(invalidTpl);
    expect(result.valid).toBe(false);
    expect(result.invalidVariables).toContain("user_credit_card");
    expect(result.invalidVariables).toContain("secret_code");
    expect(result.variables).toContain("product");
  });

  it("should interpolate template variables with provided values", () => {
    const tpl = "Hello {{author}}, thanks for asking about {{product}}! Pricing starts at {{price}}. See {{link}}.";
    const values = {
      author: "Sarah",
      product: "OmniDesk Pro",
      price: "$199",
      link: "https://omnipost.local/deals",
    };
    const rendered = interpolateTemplate(tpl, values);
    expect(rendered).toBe("Hello Sarah, thanks for asking about OmniDesk Pro! Pricing starts at $199. See https://omnipost.local/deals.");
  });

  it("should handle missing variables by replacing them with empty string", () => {
    const tpl = "Welcome {{author}} to {{brand}}! Product: {{product}}";
    const rendered = interpolateTemplate(tpl, { brand: "OmniPost" });
    expect(rendered).toBe("Welcome  to OmniPost! Product: ");
  });
});

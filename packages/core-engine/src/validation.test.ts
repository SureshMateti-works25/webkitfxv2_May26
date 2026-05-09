import { describe, expect, it } from "vitest";
import type { EngineContext, FieldDefinition } from "./types.js";
import { validateFormFields } from "./validation.js";

const ctx: EngineContext = {
  rules: {
    formats: {},
    customs: {
      inrPaise: ({ value }) =>
        typeof value === "number" && Number.isInteger(value) && value >= 0
          ? true
          : "INR amount must be a non-negative integer (paise)"
    }
  },
  conditions: { customs: {} }
};

describe("validateFormFields", () => {
  it("skips hidden fields by default", async () => {
    const fields: Record<string, FieldDefinition> = {
      x: {
        binding: "x",
        widget: "text",
        visibleWhen: { op: "false" },
        rules: [{ kind: "required" }]
      },
      y: { binding: "y", widget: "text", rules: [{ kind: "required" }] }
    };
    const issues = await validateFormFields(fields, { y: "" }, ctx);
    expect(issues.x).toBeUndefined();
    expect(issues.y?.length).toBeGreaterThan(0);
  });

  it("validates custom rule (e.g. INR paise)", async () => {
    const fields: Record<string, FieldDefinition> = {
      price: {
        binding: "price",
        widget: "number",
        rules: [{ kind: "custom", id: "inrPaise" }]
      }
    };
    const bad = await validateFormFields(fields, { price: 10.5 }, ctx);
    expect(bad.price?.[0]?.message).toContain("paise");
    const good = await validateFormFields(fields, { price: 1050 }, ctx);
    expect(good.price).toBeUndefined();
  });

  it("dateBeforeNow", async () => {
    const fields: Record<string, FieldDefinition> = {
      d: { binding: "d", widget: "date", rules: [{ kind: "dateBeforeNow" }] }
    };
    const future = new Date(Date.now() + 86400000).toISOString();
    const issues = await validateFormFields(fields, { d: future }, ctx);
    expect(issues.d?.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { evaluateCondition } from "./conditions.js";
import type { ConditionRegistry } from "./types.js";

const registry: ConditionRegistry = {
  customs: {
    roleIs: ({ values, params }) => {
      const role = (values as { role?: string })?.role;
      return role === params?.role;
    }
  }
};

describe("evaluateCondition", () => {
  it("evaluates eqPath and and/or", async () => {
    const values = { a: 1, b: 1, c: 2 };
    expect(await evaluateCondition({ op: "eqPath", left: "a", right: "b" }, values, registry)).toBe(
      true
    );
    expect(await evaluateCondition({ op: "eqPath", left: "a", right: "c" }, values, registry)).toBe(
      false
    );
    expect(
      await evaluateCondition(
        { op: "and", all: [{ op: "notEmpty", path: "a" }, { op: "empty", path: "z" }] },
        values,
        registry
      )
    ).toBe(true);
  });

  it("runs custom condition ids from app registry", async () => {
    expect(
      await evaluateCondition({ op: "custom", id: "roleIs", params: { role: "admin" } }, { role: "admin" }, registry)
    ).toBe(true);
    expect(
      await evaluateCondition({ op: "custom", id: "roleIs", params: { role: "admin" } }, { role: "guest" }, registry)
    ).toBe(false);
    expect(await evaluateCondition({ op: "custom", id: "missing" }, {}, registry)).toBe(false);
  });
});

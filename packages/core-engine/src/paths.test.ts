import { describe, expect, it } from "vitest";
import { getAtPath, setAtPath } from "./paths.js";

describe("setAtPath", () => {
  it("materializes object at array index before setting nested property (vendor contacts)", () => {
    const root = setAtPath({}, "vendor.contacts[0].name", "Priya");
    expect(getAtPath(root, "vendor.contacts[0].name")).toBe("Priya");
    const r = root as Record<string, unknown>;
    const vendor = r["vendor"] as Record<string, unknown>;
    const contacts = vendor["contacts"] as unknown[];
    expect(Array.isArray(contacts)).toBe(true);
    expect(contacts[0]).toEqual({ name: "Priya" });
  });

  it("keeps existing object at index when extending", () => {
    const base = { a: [{ x: 1 }] };
    const root = setAtPath(base, "a[0].y", 2);
    expect(getAtPath(root, "a[0].x")).toBe(1);
    expect(getAtPath(root, "a[0].y")).toBe(2);
  });
});

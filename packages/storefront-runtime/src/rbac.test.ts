import { describe, expect, it } from "vitest";
import { defaultRbac } from "./rbac.js";

describe("tenant RBAC manifest", () => {
  it("grants catalog read to shoppers", () => {
    expect(defaultRbac.hasPermission("shopper", "isolated_shop", "catalog:read")).toBe(true);
  });

  it("denies admin self-register", () => {
    expect(defaultRbac.canSelfRegister("admin")).toBe(false);
  });

  it("exposes marketplace features", () => {
    expect(defaultRbac.featuresFor("marketplace")).toContain("vendor_directory");
  });
});

import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext (open redirect guard)", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/w/kinetic/projects")).toBe("/w/kinetic/projects");
    expect(safeNext(["/invite/inv_1", "/other"])).toBe("/invite/inv_1");
  });

  it("drops anything that can leave the site", () => {
    for (const value of ["//evil.example", String.raw`/\evil.example`, "https://evil.example", "evil.example", "", null, undefined]) {
      expect(safeNext(value), String(value)).toBeUndefined();
    }
  });
});

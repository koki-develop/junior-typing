import { describe, expect, it } from "vitest";
import { CATEGORIES, findCategory } from "./categories.ts";

describe("CATEGORIES", () => {
  it("1件以上ある", () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
  });

  it("id はセット全体で一意である", () => {
    const ids = CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CATEGORIES)("$id の label は空でない", ({ label }) => {
    expect(label).not.toBe("");
  });

  it.each(CATEGORIES)("$id の color は #rrggbb 形式である", ({ color }) => {
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("存在する id を渡すと該当する Category を返す", () => {
    expect(findCategory("animals")).toEqual({
      id: "animals",
      label: "どうぶつ",
      color: "#d97706",
    });
  });

  it("存在しない id を渡すと undefined を返す", () => {
    expect(findCategory("unknown")).toBeUndefined();
  });
});

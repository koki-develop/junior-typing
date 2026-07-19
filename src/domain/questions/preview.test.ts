import { describe, expect, it } from "vitest";
import { previewWords } from "./preview.ts";
import type { QuestionSet } from "./types.ts";

function makeSet(texts: string[]): QuestionSet {
  return {
    id: "test",
    title: "test",
    category: "animals",
    questionCount: 1,
    questions: texts.map((text) => ({ text, kana: "あ" })),
  };
}

describe("previewWords", () => {
  it("先頭 max 件までを「・」で連結する", () => {
    const set = makeSet(["いぬ", "ねこ", "うさぎ", "ぞう", "きりん"]);
    expect(previewWords(set, 3)).toBe("いぬ・ねこ・うさぎ");
  });

  it("max より少ないときは全件を連結する", () => {
    const set = makeSet(["いぬ", "ねこ"]);
    expect(previewWords(set, 8)).toBe("いぬ・ねこ");
  });

  it("既定の max は 8 件", () => {
    const set = makeSet(Array.from({ length: 12 }, (_, i) => `語${i}`));
    expect(previewWords(set).split("・")).toHaveLength(8);
  });
});

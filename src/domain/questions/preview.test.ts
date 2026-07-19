import { describe, expect, it } from "vitest";
import { previewWords } from "./preview.ts";
import type { QuestionSet } from "./types.ts";

function makeSet(texts: string[]): QuestionSet {
  return {
    id: "test",
    title: "test",
    category: "animals",
    questionCount: 1,
    randomOrder: true,
    questions: texts.map((text) => ({ text, kana: "あ" })),
  };
}

describe("previewWords", () => {
  it("全件を「・」で連結する", () => {
    const set = makeSet(["いぬ", "ねこ", "うさぎ", "ぞう", "きりん"]);
    expect(previewWords(set)).toBe("いぬ・ねこ・うさぎ・ぞう・きりん");
  });

  it("件数が多くても全件を連結する", () => {
    const set = makeSet(Array.from({ length: 12 }, (_, i) => `語${i}`));
    expect(previewWords(set).split("・")).toHaveLength(12);
  });
});

import { describe, expect, it } from "vitest";
import { selectQuestions } from "./select.ts";
import type { Question } from "./types.ts";

const pool: Question[] = [
  { text: "あ", kana: "あ" },
  { text: "い", kana: "い" },
  { text: "う", kana: "う" },
  { text: "え", kana: "え" },
  { text: "お", kana: "お" },
];

describe("selectQuestions", () => {
  it("指定した件数を返す", () => {
    const result = selectQuestions(pool, 3, () => 0);
    expect(result).toHaveLength(3);
  });

  it("pool 由来の要素のみを重複なく返す（count === pool.length）", () => {
    const result = selectQuestions(pool, pool.length, () => 0.5);
    expect(new Set(result)).toEqual(new Set(pool));
    expect(result).toHaveLength(pool.length);
  });

  // Fisher-Yates で random が常に 0 を返すと j は毎回 0 になるため、
  // i=4→swap(4,0), i=3→swap(3,0), i=2→swap(2,0), i=1→swap(1,0) の順で並び替わり、
  // [あ,い,う,え,お] は決定的に [い,う,え,お,あ] になる。
  it("random の戻り値に応じて決定的に並び替わる", () => {
    const result = selectQuestions(pool, pool.length, () => 0);
    expect(result.map((q) => q.text)).toEqual(["い", "う", "え", "お", "あ"]);
  });

  it("random を省略すると Math.random を使い、pool の部分集合を返す", () => {
    const result = selectQuestions(pool, 3);
    expect(result).toHaveLength(3);
    for (const question of result) {
      expect(pool).toContain(question);
    }
  });
});

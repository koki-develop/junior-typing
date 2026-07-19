import { describe, expect, it } from "vitest";
import { selectQuestions } from "./select.ts";
import type { Question } from "./types.ts";

const pool: Question[] = [
  { text: "あ", kanas: ["あ"] },
  { text: "い", kanas: ["い"] },
  { text: "う", kanas: ["う"] },
  { text: "え", kanas: ["え"] },
  { text: "お", kanas: ["お"] },
];

describe("selectQuestions", () => {
  describe("randomOrder=true", () => {
    it("指定した件数を返す", () => {
      const result = selectQuestions(pool, 3, true, () => 0);
      expect(result).toHaveLength(3);
    });

    it("pool 由来の要素のみを重複なく返す（count === pool.length）", () => {
      const result = selectQuestions(pool, pool.length, true, () => 0.5);
      expect(new Set(result)).toEqual(new Set(pool));
      expect(result).toHaveLength(pool.length);
    });

    // Fisher-Yates で random が常に 0 を返すと j は毎回 0 になるため、
    // i=4→swap(4,0), i=3→swap(3,0), i=2→swap(2,0), i=1→swap(1,0) の順で並び替わり、
    // [あ,い,う,え,お] は決定的に [い,う,え,お,あ] になる。
    it("random の戻り値に応じて決定的に並び替わる", () => {
      const result = selectQuestions(pool, pool.length, true, () => 0);
      expect(result.map((q) => q.text)).toEqual(["い", "う", "え", "お", "あ"]);
    });

    it("random を省略すると Math.random を使い、pool の部分集合を返す", () => {
      const result = selectQuestions(pool, 3, true);
      expect(result).toHaveLength(3);
      for (const question of result) {
        expect(pool).toContain(question);
      }
    });
  });

  describe("randomOrder=false", () => {
    it("シャッフルせず pool 定義順のまま先頭 count 件を返す", () => {
      const result = selectQuestions(pool, 3, false, () => 0);
      expect(result.map((q) => q.text)).toEqual(["あ", "い", "う"]);
    });

    it("count === pool.length のとき定義順の全件を返す", () => {
      const result = selectQuestions(pool, pool.length, false, () => 0);
      expect(result.map((q) => q.text)).toEqual(["あ", "い", "う", "え", "お"]);
    });

    // random 関数はそもそも呼ばれないので、呼ばれたら fail するようにして
    // 「シャッフル経路を確実に通っていない」ことをテストで固定する。
    it("random 関数は呼ばれない", () => {
      const random = () => {
        throw new Error("random should not be called when randomOrder=false");
      };
      expect(() => selectQuestions(pool, 3, false, random)).not.toThrow();
    });
  });
});

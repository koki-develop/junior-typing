import { describe, expect, it } from "vitest";
import { buildPatterns } from "../romaji/patterns.ts";
import { findCategory } from "./categories.ts";
import { questionSets } from "./questions.ts";

// 出題データの不正を CI で落とすため、追加・変更のたびにここで機械的に検証する。
// kana: "" は buildPatterns が空配列を返して素通りしてしまい、
// isFinished が最初から true になってゲームが進行不能になるため、
// 「throw しない」ではなく「1モーラ以上を生成する」まで検証する。
describe("questionSets", () => {
  it("セットが1つ以上ある", () => {
    expect(questionSets.length).toBeGreaterThan(0);
  });

  it.each(questionSets)("$title の id は空でない", ({ id }) => {
    expect(id).not.toBe("");
  });

  it("id はセット全体で一意である", () => {
    const ids = questionSets.map((set) => set.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(questionSets)("$title に問題が1問以上ある", ({ questions }) => {
    expect(questions.length).toBeGreaterThan(0);
  });

  it.each(questionSets)(
    "$title の category は CATEGORIES に存在する id を参照している",
    ({ category }) => {
      expect(findCategory(category)).not.toBeUndefined();
    },
  );

  // questionCount は selectQuestions がプールから無作為抽出する件数の契約。
  // questions.length を超えると抽出しきれないデータ不正になるため、ここで CI が落とす。
  it.each(questionSets)(
    "$title の questionCount は1以上 questions.length 以下である",
    ({ questionCount, questions }) => {
      expect(questionCount).toBeGreaterThan(0);
      expect(questionCount).toBeLessThanOrEqual(questions.length);
    },
  );

  // it.each は Question 配列をフラット化する用途に使えないので、全セットを平坦に並べ直してから走査する。
  const allQuestions = questionSets.flatMap((set) =>
    set.questions.map((question) => ({ setId: set.id, ...question })),
  );

  it.each(allQuestions)(
    "[$setId] $text の kana ($kana) は buildPatterns で1モーラ以上を生成する",
    ({ kana }) => {
      expect(buildPatterns(kana).length).toBeGreaterThan(0);
    },
  );
});

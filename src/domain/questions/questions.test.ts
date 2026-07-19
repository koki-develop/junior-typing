import { describe, expect, it } from "vitest";
import { buildPatterns } from "../romaji/patterns.ts";
import { findCategory } from "./categories.ts";
import { questionSets } from "./questions.ts";

// 出題データの不正を CI で落とすため、追加・変更のたびにここで機械的に検証する。
// 空文字列の kana は buildPatterns が空配列を返して素通りしてしまい、
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
  // 複数読み対応後は kanas の全要素を個別に検証したいので、(setId, text, kanaIdx, kana) の
  // タプルに展開する。
  const allQuestions = questionSets.flatMap((set) =>
    set.questions.map((question) => ({ setId: set.id, ...question })),
  );

  it.each(allQuestions)("[$setId] $text の kanas は1つ以上ある", ({ kanas }) => {
    expect(kanas.length).toBeGreaterThan(0);
  });

  const allKanas = allQuestions.flatMap((q) =>
    q.kanas.map((kana, kanaIdx) => ({ setId: q.setId, text: q.text, kanaIdx, kana })),
  );

  it.each(allKanas)(
    "[$setId] $text の kanas[$kanaIdx] ($kana) は buildPatterns で1モーラ以上を生成する",
    ({ kana }) => {
      expect(buildPatterns(kana).length).toBeGreaterThan(0);
    },
  );

  // タイピングエンジンは「先頭アクティブトラック」が完了したらゲーム完了と判定するため、
  // 同一 Question 内で kanas[i] が kanas[j] の prefix になっていると kanas[i] より
  // 後ろの読みは実質到達不能になる（打ち切った瞬間に短い方が先に完了してしまう）。
  // types.ts のデータ規約に書いた「より長い読みを先頭に置く」を CI 側で機械的に強制する。
  it.each(allQuestions)("[$setId] $text の kanas は互いに prefix 関係にない", ({ kanas }) => {
    for (let i = 0; i < kanas.length; i++) {
      for (let j = 0; j < kanas.length; j++) {
        if (i === j) continue;
        // kanas[j] が kanas[i] の prefix なら kanas[i] は到達不能。
        // 完全一致（i != j かつ kanas[i] === kanas[j]）も検出できる。
        expect(kanas[i].startsWith(kanas[j])).toBe(false);
      }
    }
  });
});

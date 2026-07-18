import { describe, expect, it } from "vitest";
import { buildPatterns } from "../romaji/patterns.ts";
import { questions } from "./questions.ts";

// 出題データの不正を CI で落とすため、追加・変更のたびにここで機械的に検証する。
// kana: "" は buildPatterns が空配列を返して素通りしてしまい、
// isFinished が最初から true になってゲームが進行不能になるため、
// 「throw しない」ではなく「1モーラ以上を生成する」まで検証する。
describe("questions", () => {
  it("問題が1問以上ある", () => {
    expect(questions.length).toBeGreaterThan(0);
  });

  it.each(questions)(
    "$text の kana ($kana) は buildPatterns で1モーラ以上を生成する",
    ({ kana }) => {
      expect(buildPatterns(kana).length).toBeGreaterThan(0);
    },
  );
});

import { describe, expect, it } from "vitest";
import type { Question } from "../questions/types.ts";
import { createTypingState, typeKey } from "../romaji/typing.ts";
import type { GameState } from "./machine.ts";
import { computeResult } from "./score.ts";
import { selectView } from "./view.ts";

const questions: Question[] = [
  { text: "こんにちは", kana: "こんにちは" },
  { text: "ありがとう", kana: "ありがとう" },
];

const T0 = 1_700_000_000_000;

describe("selectView", () => {
  it("idle は total のみを持つ", () => {
    const state: GameState = { phase: "idle" };
    expect(selectView(state, questions)).toEqual({ phase: "idle", total: 2 });
  });

  it("countdown は count と total を持つ", () => {
    const state: GameState = { phase: "countdown", count: 3 };
    expect(selectView(state, questions)).toEqual({ phase: "countdown", total: 2, count: 3 });
  });

  it("done は total と computeResult 済みの result を持つ", () => {
    const stats = { correctKeys: 8, wrongKeys: 2, startedAt: T0 };
    const endedAt = T0 + 15_500;
    const state: GameState = { phase: "done", stats, endedAt };
    expect(selectView(state, questions)).toEqual({
      phase: "done",
      total: 2,
      result: computeResult(stats, endedAt),
    });
  });

  it("playing の初期状態は typed が空で next/rest が全体を表す", () => {
    const state: GameState = {
      phase: "playing",
      questionIndex: 0,
      typingState: createTypingState(questions[0].kana),
      cleared: false,
      stats: { correctKeys: 0, wrongKeys: 0, startedAt: T0 },
    };
    const view = selectView(state, questions);
    expect(view).toEqual({
      phase: "playing",
      total: 2,
      questionIndex: 0,
      question: questions[0],
      typed: "",
      next: "k",
      rest: "onnnitiha",
      cleared: false,
    });
  });

  it("playing の入力途中は typed/next/rest が入力位置に沿って分割される", () => {
    // "kon" まで打鍵した状態を作り、次の1文字と残りの分割を検証する
    let typingState = createTypingState(questions[0].kana);
    for (const key of "kon") {
      typingState = typeKey(typingState, key).state;
    }
    const state: GameState = {
      phase: "playing",
      questionIndex: 0,
      typingState,
      cleared: false,
      stats: { correctKeys: 3, wrongKeys: 0, startedAt: T0 },
    };
    const view = selectView(state, questions);
    expect(view).toMatchObject({
      typed: "kon",
      next: "n",
      rest: "nitiha",
      cleared: false,
    });
  });

  it("playing の cleared 中は入力が完了しきっており next/rest が空になる", () => {
    // 短い問題を全部打ち切って cleared 相当の typingState を作る
    let typingState = createTypingState("あ");
    typingState = typeKey(typingState, "a").state;
    const state: GameState = {
      phase: "playing",
      questionIndex: 0,
      typingState,
      cleared: true,
      stats: { correctKeys: 1, wrongKeys: 0, startedAt: T0 },
    };
    const view = selectView(state, [{ text: "あ", kana: "あ" }]);
    expect(view).toEqual({
      phase: "playing",
      total: 1,
      questionIndex: 0,
      question: { text: "あ", kana: "あ" },
      typed: "a",
      next: "",
      rest: "",
      cleared: true,
    });
  });
});

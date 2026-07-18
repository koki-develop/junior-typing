import { describe, expect, it } from "vitest";
import type { Question } from "../questions/types.ts";
import { createTypingState } from "../romaji/typing.ts";
import { CLEAR_DELAY_MS, COUNTDOWN_STEP_MS, createInitialState, transition } from "./machine.ts";
import type { GameEvent, GameState } from "./machine.ts";

// 単モーラの問題2問。1打鍵で確定させて cleared / advance 周りを検証しやすくする。
const singleMoraQuestions: Question[] = [
  { text: "あ", kana: "あ" },
  { text: "い", kana: "い" },
];

// 2モーラの問題1問。「正解だが未完」の遷移を検証するために使う。
const twoMoraQuestions: Question[] = [{ text: "あい", kana: "あい" }];

describe("transition", () => {
  describe("idle", () => {
    it("スペースキーで countdown(3) に遷移し、bloom音とtickのスケジュールを積む", () => {
      const state = createInitialState();
      const result = transition(state, { type: "key", key: " " }, singleMoraQuestions);
      expect(result.state).toEqual({ phase: "countdown", count: 3 });
      expect(result.effects).toEqual([
        { type: "playSound", sound: "bloom" },
        { type: "schedule", event: { type: "tick" }, delayMs: COUNTDOWN_STEP_MS },
      ]);
    });
  });

  describe("countdown", () => {
    it("count=3 の tick で count=2 に進み、bloom音とtickのスケジュールを積む", () => {
      const state: GameState = { phase: "countdown", count: 3 };
      const result = transition(state, { type: "tick" }, singleMoraQuestions);
      expect(result.state).toEqual({ phase: "countdown", count: 2 });
      expect(result.effects).toEqual([
        { type: "playSound", sound: "bloom" },
        { type: "schedule", event: { type: "tick" }, delayMs: COUNTDOWN_STEP_MS },
      ]);
    });

    it("count=2 の tick で count=1 に進み、bloom音とtickのスケジュールを積む", () => {
      const state: GameState = { phase: "countdown", count: 2 };
      const result = transition(state, { type: "tick" }, singleMoraQuestions);
      expect(result.state).toEqual({ phase: "countdown", count: 1 });
      expect(result.effects).toEqual([
        { type: "playSound", sound: "bloom" },
        { type: "schedule", event: { type: "tick" }, delayMs: COUNTDOWN_STEP_MS },
      ]);
    });

    it("count=1 の tick で playing(最初の問題) に遷移し、ready音を鳴らす", () => {
      const state: GameState = { phase: "countdown", count: 1 };
      const result = transition(state, { type: "tick" }, singleMoraQuestions);
      expect(result.state).toEqual({
        phase: "playing",
        questionIndex: 0,
        typingState: createTypingState(singleMoraQuestions[0].kana),
        cleared: false,
      });
      expect(result.effects).toEqual([{ type: "playSound", sound: "ready" }]);
    });
  });

  describe("playing", () => {
    it("正解キー（未完）で typingState が進み、page音を鳴らす", () => {
      const state: GameState = {
        phase: "playing",
        questionIndex: 0,
        typingState: createTypingState(twoMoraQuestions[0].kana),
        cleared: false,
      };
      const result = transition(state, { type: "key", key: "a" }, twoMoraQuestions);
      expect(result.state).toEqual({
        phase: "playing",
        questionIndex: 0,
        typingState: { ...createTypingState(twoMoraQuestions[0].kana), unitIndex: 1, typed: "a" },
        cleared: false,
      });
      expect(result.effects).toEqual([{ type: "playSound", sound: "page" }]);
    });

    it("誤りキーは状態を変えず（同一参照）、error音のみ鳴らす", () => {
      const state: GameState = {
        phase: "playing",
        questionIndex: 0,
        typingState: createTypingState(singleMoraQuestions[0].kana),
        cleared: false,
      };
      const result = transition(state, { type: "key", key: "x" }, singleMoraQuestions);
      expect(result.state).toBe(state);
      expect(result.effects).toEqual([{ type: "playSound", sound: "error" }]);
    });

    it("最終モーラを確定させる正解キーで cleared=true になり、page・success・advanceのスケジュールを積む", () => {
      const state: GameState = {
        phase: "playing",
        questionIndex: 0,
        typingState: createTypingState(singleMoraQuestions[0].kana),
        cleared: false,
      };
      const result = transition(state, { type: "key", key: "a" }, singleMoraQuestions);
      expect(result.state).toMatchObject({
        phase: "playing",
        questionIndex: 0,
        cleared: true,
      });
      expect(result.effects).toEqual([
        { type: "playSound", sound: "page" },
        { type: "playSound", sound: "success" },
        { type: "schedule", event: { type: "advance" }, delayMs: CLEAR_DELAY_MS },
      ]);
    });

    it("advance（次の問題あり）で次の問題に進み、ready音を鳴らす", () => {
      const clearedState: GameState = {
        phase: "playing",
        questionIndex: 0,
        typingState: {
          ...createTypingState(singleMoraQuestions[0].kana),
          unitIndex: 1,
          typed: "a",
        },
        cleared: true,
      };
      const result = transition(clearedState, { type: "advance" }, singleMoraQuestions);
      expect(result.state).toEqual({
        phase: "playing",
        questionIndex: 1,
        typingState: createTypingState(singleMoraQuestions[1].kana),
        cleared: false,
      });
      expect(result.effects).toEqual([{ type: "playSound", sound: "ready" }]);
    });

    it("最終問題の advance で done に遷移し、effectsは空", () => {
      const clearedState: GameState = {
        phase: "playing",
        questionIndex: singleMoraQuestions.length - 1,
        typingState: {
          ...createTypingState(singleMoraQuestions[singleMoraQuestions.length - 1].kana),
          unitIndex: 1,
          typed: "i",
        },
        cleared: true,
      };
      const result = transition(clearedState, { type: "advance" }, singleMoraQuestions);
      expect(result.state).toEqual({ phase: "done" });
      expect(result.effects).toEqual([]);
    });
  });

  // 「イベントを無視して同一参照の state を返し、effects も積まない」系のケースをまとめる。
  // 状態やイベントの組み合わせが違うだけで assert 内容は共通なので、個別 it に展開すると
  // コピペになる。it.each のテーブルに列挙し、カバレッジは元の個別テストと同数に保つ。
  describe("無視されるイベント（同一参照 state・空 effects）", () => {
    const clearedPlayingState: GameState = {
      phase: "playing",
      questionIndex: 0,
      typingState: { ...createTypingState(singleMoraQuestions[0].kana), unitIndex: 1, typed: "a" },
      cleared: true,
    };
    const notClearedPlayingState: GameState = {
      phase: "playing",
      questionIndex: 0,
      typingState: createTypingState(singleMoraQuestions[0].kana),
      cleared: false,
    };

    const cases: { name: string; state: GameState; event: GameEvent }[] = [
      {
        name: "idle: START_KEY 以外のキー",
        state: createInitialState(),
        event: { type: "key", key: "a" },
      },
      { name: "idle: tick", state: createInitialState(), event: { type: "tick" } },
      { name: "idle: advance", state: createInitialState(), event: { type: "advance" } },
      {
        name: "countdown: 打鍵",
        state: { phase: "countdown", count: 3 },
        event: { type: "key", key: "a" },
      },
      {
        name: "countdown: advance",
        state: { phase: "countdown", count: 3 },
        event: { type: "advance" },
      },
      { name: "playing(未クリア): tick", state: notClearedPlayingState, event: { type: "tick" } },
      {
        name: "playing(未クリア): advance",
        state: notClearedPlayingState,
        event: { type: "advance" },
      },
      {
        name: "playing(クリア演出中): 打鍵",
        state: clearedPlayingState,
        event: { type: "key", key: "a" },
      },
      { name: "done: 打鍵", state: { phase: "done" }, event: { type: "key", key: "a" } },
      { name: "done: tick", state: { phase: "done" }, event: { type: "tick" } },
      { name: "done: advance", state: { phase: "done" }, event: { type: "advance" } },
    ];

    it.each(cases)("$name", ({ state, event }) => {
      const result = transition(state, event, singleMoraQuestions);
      expect(result.state).toBe(state);
      expect(result.effects).toEqual([]);
    });
  });
});

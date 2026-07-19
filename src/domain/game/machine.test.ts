import { describe, expect, it } from "vitest";
import type { Question } from "../questions/types.ts";
import { createTypingState, typeKey } from "../romaji/typing.ts";
import type { TypingState } from "../romaji/typing.ts";
import { CLEAR_DELAY_MS, COUNTDOWN_STEP_MS, createInitialState, transition } from "./machine.ts";
import type { GameEvent, GameState, PlayingStats } from "./machine.ts";

// createTypingState(kanas) → 指定キー列を順に受理させた TypingState を返す。
// 「1問クリア済み相当の typingState を手で組み立てる」ためのテストヘルパー。
// TypingState の内部形（tracks/activeMask）が将来変わってもテスト側は typeKey 経由で
// 「正しく打ち切った結果の状態」を作れる。
function typedTypingState(kanas: string[], keys: string): TypingState {
  let state = createTypingState(kanas);
  for (const key of keys) {
    state = typeKey(state, key).state;
  }
  return state;
}

// 単モーラの問題2問。1打鍵で確定させて cleared / advance 周りを検証しやすくする。
const singleMoraQuestions: Question[] = [
  { text: "あ", kanas: ["あ"] },
  { text: "い", kanas: ["い"] },
];

// 2モーラの問題1問。「正解だが未完」の遷移を検証するために使う。
const twoMoraQuestions: Question[] = [{ text: "あい", kanas: ["あい"] }];

// テスト用の任意時刻。stats の startedAt / endedAt へ焼き込まれる値としてのみ意味を持つ。
const T0 = 1_700_000_000_000;

// playing 状態を作るためのヘルパー。startedAt 以外は 0 で初期化した stats を持たせる。
// 呼び出し側で typingState 等にアクセスするため、GameState ではなく playing バリアントの
// 具体型で返す（GameState だと union の他バリアント経由でアクセスできない）。
type PlayingState = Extract<GameState, { phase: "playing" }>;
function playingState(
  questionIndex: number,
  kanas: string[],
  cleared: boolean,
  stats: PlayingStats,
): PlayingState {
  return {
    phase: "playing",
    questionIndex,
    typingState: createTypingState(kanas),
    cleared,
    stats,
  };
}

describe("transition", () => {
  describe("idle", () => {
    it("スペースキーで countdown(3) に遷移し、bloom音とtickのスケジュールを積む", () => {
      const state = createInitialState();
      const result = transition(state, { type: "key", key: " ", now: T0 }, singleMoraQuestions);
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
      const result = transition(state, { type: "tick", now: T0 }, singleMoraQuestions);
      expect(result.state).toEqual({ phase: "countdown", count: 2 });
      expect(result.effects).toEqual([
        { type: "playSound", sound: "bloom" },
        { type: "schedule", event: { type: "tick" }, delayMs: COUNTDOWN_STEP_MS },
      ]);
    });

    it("count=2 の tick で count=1 に進み、bloom音とtickのスケジュールを積む", () => {
      const state: GameState = { phase: "countdown", count: 2 };
      const result = transition(state, { type: "tick", now: T0 }, singleMoraQuestions);
      expect(result.state).toEqual({ phase: "countdown", count: 1 });
      expect(result.effects).toEqual([
        { type: "playSound", sound: "bloom" },
        { type: "schedule", event: { type: "tick" }, delayMs: COUNTDOWN_STEP_MS },
      ]);
    });

    it("count=1 の tick で playing(最初の問題) に遷移し、stats を初期化して startedAt に now を焼き込む", () => {
      const state: GameState = { phase: "countdown", count: 1 };
      const result = transition(state, { type: "tick", now: T0 }, singleMoraQuestions);
      expect(result.state).toEqual({
        phase: "playing",
        questionIndex: 0,
        typingState: createTypingState(singleMoraQuestions[0].kanas),
        cleared: false,
        stats: { correctKeys: 0, wrongKeys: 0, startedAt: T0, clearedMs: 0 },
      });
      expect(result.effects).toEqual([{ type: "playSound", sound: "ready" }]);
    });
  });

  describe("playing", () => {
    it("正解キー（未完）で typingState が進み、correctKeys がインクリメントされ page音を鳴らす", () => {
      const state = playingState(0, twoMoraQuestions[0].kanas, false, {
        correctKeys: 0,
        wrongKeys: 0,
        startedAt: T0,
        clearedMs: 0,
      });
      const result = transition(state, { type: "key", key: "a", now: T0 }, twoMoraQuestions);
      expect(result.state).toEqual({
        phase: "playing",
        questionIndex: 0,
        typingState: typedTypingState(twoMoraQuestions[0].kanas, "a"),
        cleared: false,
        stats: { correctKeys: 1, wrongKeys: 0, startedAt: T0, clearedMs: 0 },
      });
      expect(result.effects).toEqual([{ type: "playSound", sound: "page" }]);
    });

    it("誤りキーは typingState は変わらないが wrongKeys をインクリメントし error音のみ鳴らす", () => {
      const state = playingState(0, singleMoraQuestions[0].kanas, false, {
        correctKeys: 2,
        wrongKeys: 0,
        startedAt: T0,
        clearedMs: 0,
      });
      const result = transition(state, { type: "key", key: "x", now: T0 }, singleMoraQuestions);
      // 打鍵内容自体は typingState には反映されず、stats.wrongKeys だけが +1 される。
      expect(result.state).toEqual({
        ...state,
        stats: { correctKeys: 2, wrongKeys: 1, startedAt: T0, clearedMs: 0 },
      });
      expect(result.effects).toEqual([{ type: "playSound", sound: "error" }]);
    });

    it("最終モーラを確定させる正解キーで cleared=true, correctKeys+1 になり、clearedAt を焼き込み page・success・advanceのスケジュールを積む", () => {
      const state = playingState(0, singleMoraQuestions[0].kanas, false, {
        correctKeys: 3,
        wrongKeys: 1,
        startedAt: T0,
        clearedMs: 0,
      });
      const now = T0 + 500;
      const result = transition(state, { type: "key", key: "a", now }, singleMoraQuestions);
      expect(result.state).toMatchObject({
        phase: "playing",
        questionIndex: 0,
        cleared: true,
        // 入力不可時間の計測起点として、cleared 化と同じ now を焼き込む。
        clearedAt: now,
        stats: { correctKeys: 4, wrongKeys: 1, startedAt: T0, clearedMs: 0 },
      });
      expect(result.effects).toEqual([
        { type: "playSound", sound: "page" },
        { type: "playSound", sound: "success" },
        { type: "schedule", event: { type: "advance" }, delayMs: CLEAR_DELAY_MS },
      ]);
    });

    it("advance（次の問題あり）で clearedMs にクリア演出時間が積まれ、次の問題に進む", () => {
      const clearedAt = T0 + 2000;
      const clearedState: GameState = {
        phase: "playing",
        questionIndex: 0,
        typingState: typedTypingState(singleMoraQuestions[0].kanas, "a"),
        cleared: true,
        clearedAt,
        stats: { correctKeys: 5, wrongKeys: 2, startedAt: T0, clearedMs: 0 },
      };
      const advanceNow = clearedAt + 600; // CLEAR_DELAY_MS 相当の演出時間
      const result = transition(
        clearedState,
        { type: "advance", now: advanceNow },
        singleMoraQuestions,
      );
      expect(result.state).toEqual({
        phase: "playing",
        questionIndex: 1,
        typingState: createTypingState(singleMoraQuestions[1].kanas),
        cleared: false,
        // clearedMs には advance-clearedAt が加算され、次問への遷移で
        // clearedAt はリセット（undefined）される。
        stats: { correctKeys: 5, wrongKeys: 2, startedAt: T0, clearedMs: 600 },
      });
      expect(result.effects).toEqual([{ type: "playSound", sound: "ready" }]);
    });

    it("最終問題の advance で done に遷移し、clearedMs を積んで endedAt を焼き込み effects は空", () => {
      const clearedAt = T0 + 10_000;
      const clearedState: GameState = {
        phase: "playing",
        questionIndex: singleMoraQuestions.length - 1,
        typingState: typedTypingState(
          singleMoraQuestions[singleMoraQuestions.length - 1].kanas,
          "i",
        ),
        cleared: true,
        clearedAt,
        stats: { correctKeys: 7, wrongKeys: 3, startedAt: T0, clearedMs: 600 },
      };
      const endedAt = clearedAt + 700; // setTimeout がぶれて 700ms 掛かった想定
      const result = transition(
        clearedState,
        { type: "advance", now: endedAt },
        singleMoraQuestions,
      );
      expect(result.state).toEqual({
        phase: "done",
        // 既存 clearedMs(600) + 今回のクリア演出(endedAt - clearedAt = 700) = 1300
        stats: { correctKeys: 7, wrongKeys: 3, startedAt: T0, clearedMs: 1300 },
        endedAt,
      });
      expect(result.effects).toEqual([]);
    });
  });

  describe("done", () => {
    const doneState: GameState = {
      phase: "done",
      stats: { correctKeys: 5, wrongKeys: 1, startedAt: T0, clearedMs: 0 },
      endedAt: T0 + 5000,
    };

    it("restart イベントで idle に戻る", () => {
      const result = transition(doneState, { type: "restart" }, singleMoraQuestions);
      expect(result.state).toEqual({ phase: "idle" });
      expect(result.effects).toEqual([]);
    });

    it("Space キーでも idle に戻る（idle 開始と対称的な操作）", () => {
      const result = transition(
        doneState,
        { type: "key", key: " ", now: T0 + 6000 },
        singleMoraQuestions,
      );
      expect(result.state).toEqual({ phase: "idle" });
      expect(result.effects).toEqual([]);
    });
  });

  // 「イベントを無視して同一参照の state を返し、effects も積まない」系のケースをまとめる。
  // 状態やイベントの組み合わせが違うだけで assert 内容は共通なので、個別 it に展開すると
  // コピペになる。it.each のテーブルに列挙し、カバレッジは元の個別テストと同数に保つ。
  describe("無視されるイベント（同一参照 state・空 effects）", () => {
    const clearedPlayingState = playingState(0, singleMoraQuestions[0].kanas, true, {
      correctKeys: 1,
      wrongKeys: 0,
      startedAt: T0,
      clearedMs: 0,
    });
    // cleared: true の typingState は「打ち切り済み」相当にしておく。
    // clearedAt も cleared: true の不変条件として付与する。
    const clearedPlayingStateFinished: GameState = {
      ...clearedPlayingState,
      clearedAt: T0,
      typingState: typedTypingState(singleMoraQuestions[0].kanas, "a"),
    };
    const notClearedPlayingState = playingState(0, singleMoraQuestions[0].kanas, false, {
      correctKeys: 0,
      wrongKeys: 0,
      startedAt: T0,
      clearedMs: 0,
    });
    const doneState: GameState = {
      phase: "done",
      stats: { correctKeys: 5, wrongKeys: 1, startedAt: T0, clearedMs: 0 },
      endedAt: T0 + 5000,
    };

    const cases: { name: string; state: GameState; event: GameEvent }[] = [
      {
        name: "idle: START_KEY 以外のキー",
        state: createInitialState(),
        event: { type: "key", key: "a", now: T0 },
      },
      { name: "idle: tick", state: createInitialState(), event: { type: "tick", now: T0 } },
      { name: "idle: advance", state: createInitialState(), event: { type: "advance", now: T0 } },
      { name: "idle: restart", state: createInitialState(), event: { type: "restart" } },
      {
        name: "countdown: 打鍵",
        state: { phase: "countdown", count: 3 },
        event: { type: "key", key: "a", now: T0 },
      },
      {
        name: "countdown: advance",
        state: { phase: "countdown", count: 3 },
        event: { type: "advance", now: T0 },
      },
      {
        name: "countdown: restart",
        state: { phase: "countdown", count: 3 },
        event: { type: "restart" },
      },
      {
        name: "playing(未クリア): tick",
        state: notClearedPlayingState,
        event: { type: "tick", now: T0 },
      },
      {
        name: "playing(未クリア): advance",
        state: notClearedPlayingState,
        event: { type: "advance", now: T0 },
      },
      {
        name: "playing(未クリア): restart",
        state: notClearedPlayingState,
        event: { type: "restart" },
      },
      {
        name: "playing(クリア演出中): 打鍵",
        state: clearedPlayingStateFinished,
        event: { type: "key", key: "a", now: T0 },
      },
      {
        name: "playing(クリア演出中): restart",
        state: clearedPlayingStateFinished,
        event: { type: "restart" },
      },
      {
        name: "done: 非 START_KEY 打鍵",
        state: doneState,
        event: { type: "key", key: "a", now: T0 },
      },
      { name: "done: tick", state: doneState, event: { type: "tick", now: T0 } },
      { name: "done: advance", state: doneState, event: { type: "advance", now: T0 } },
    ];

    it.each(cases)("$name", ({ state, event }) => {
      const result = transition(state, event, singleMoraQuestions);
      expect(result.state).toBe(state);
      expect(result.effects).toEqual([]);
    });
  });
});

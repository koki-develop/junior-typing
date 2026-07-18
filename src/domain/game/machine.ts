// ゲーム進行を純粋なステートマシンとして表現する。
// 副作用（効果音・タイマー）は実行せず、effects として宣言的に返すだけにする。

import type { Question } from "../questions/types.ts";
import { createTypingState, isFinished, typeKey } from "../romaji/typing.ts";
import type { TypingState } from "../romaji/typing.ts";
import type { GameEffect } from "./effects.ts";

// - idle       : 開始待ち。スペースキーでカウントダウンへ。
// - countdown  : 3 → 2 → 1 の秒読み。打鍵は無視。
// - playing    : 通常のタイピング進行。
// - done       : 全問クリア後。
export type GameState =
  | { phase: "idle" }
  | { phase: "countdown"; count: CountdownValue }
  | { phase: "playing"; questionIndex: number; typingState: TypingState; cleared: boolean }
  | { phase: "done" };

export type CountdownValue = 3 | 2 | 1;

export type GameEvent =
  | { type: "key"; key: string } // 小文字化済みの 1 文字
  | { type: "tick" } // カウントダウンを 1 段進める
  | { type: "advance" }; // クリア演出終了 → 次の問題へ

export type TransitionResult = { state: GameState; effects: GameEffect[] };

// カウントダウンの開始値。
export const COUNTDOWN_START: CountdownValue = 3;
// カウントダウン 1 段あたりの表示時間。
export const COUNTDOWN_STEP_MS = 1000;
// クリア演出を挟む時間。この間は入力を無視し、演出のあとに次の問題へ進める。
export const CLEAR_DELAY_MS = 600;
// idle からの開始トリガー。event.key の値で比較する。
export const START_KEY = " ";

export function createInitialState(): GameState {
  return { phase: "idle" };
}

// questions[index] の問題で playing に入る TransitionResult を作る。
// countdown 完了時（questions[0] から開始）と advance 時（questions[nextIndex] へ進む）が
// 同じ構築ロジックを必要とするための共通ヘルパー。
function enterQuestion(questions: readonly Question[], index: number): TransitionResult {
  return {
    state: {
      phase: "playing",
      questionIndex: index,
      typingState: createTypingState(questions[index].kana),
      cleared: false,
    },
    effects: [{ type: "playSound", sound: "ready" }],
  };
}

// カウントダウンを count の値で 1 段進める TransitionResult を作る。
// idle→countdown の開始と countdown 継続（count > 1）が同じ構築ロジックを必要とするための共通ヘルパー。
function tickCountdown(count: CountdownValue): TransitionResult {
  return {
    state: { phase: "countdown", count },
    effects: [
      { type: "playSound", sound: "bloom" },
      { type: "schedule", event: { type: "tick" }, delayMs: COUNTDOWN_STEP_MS },
    ],
  };
}

// 状態遷移のみを行う純粋関数。副作用は effects として積むだけで、実行は呼び出し側の責務。
// 状態が変化しないケースでは同一参照の state をそのまま返す。
//
// 前提契約: questions は非空であり、各要素の kana は buildPatterns で1モーラ以上を生成すること
// （questions.test.ts が保証する）。この関数自身はその前提のランタイム防御を持たない —
// データ不正は CI で落とす方針であり、ここに防御コードを足すとテストで守られている契約が
// 二重管理になるため。
export function transition(
  state: GameState,
  event: GameEvent,
  questions: readonly Question[],
): TransitionResult {
  switch (state.phase) {
    case "idle": {
      if (event.type === "key" && event.key === START_KEY) {
        return tickCountdown(COUNTDOWN_START);
      }
      return { state, effects: [] };
    }

    case "countdown": {
      if (event.type !== "tick") return { state, effects: [] };
      if (state.count > 1) {
        return tickCountdown((state.count - 1) as CountdownValue);
      }
      // 1 の次はゲーム開始。最初の問題の TypingState を作る。
      return enterQuestion(questions, 0);
    }

    case "playing": {
      if (event.type === "advance") {
        // クリア演出タイマー経由でしか来ない想定だが、cleared 以外は無視する。
        if (!state.cleared) return { state, effects: [] };
        const nextIndex = state.questionIndex + 1;
        if (nextIndex >= questions.length) {
          return { state: { phase: "done" }, effects: [] };
        }
        return enterQuestion(questions, nextIndex);
      }

      if (event.type !== "key") return { state, effects: [] };
      // クリア演出中は打鍵を握り潰す。
      if (state.cleared) return { state, effects: [] };

      const result = typeKey(state.typingState, event.key);
      if (!result.correct) {
        return { state, effects: [{ type: "playSound", sound: "error" }] };
      }
      if (!isFinished(result.state)) {
        return {
          state: { ...state, typingState: result.state },
          effects: [{ type: "playSound", sound: "page" }],
        };
      }
      // ここで questionIndex を進めず、演出を挟むために cleared だけ立てる。
      return {
        state: { ...state, typingState: result.state, cleared: true },
        effects: [
          { type: "playSound", sound: "page" },
          { type: "playSound", sound: "success" },
          { type: "schedule", event: { type: "advance" }, delayMs: CLEAR_DELAY_MS },
        ],
      };
    }

    case "done":
      return { state, effects: [] };
  }
}

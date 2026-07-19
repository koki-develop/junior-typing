// ゲーム進行を純粋なステートマシンとして表現する。
// 副作用（効果音・タイマー）は実行せず、effects として宣言的に返すだけにする。

import type { Question } from "../questions/types.ts";
import { createTypingState, isFinished, typeKey } from "../romaji/typing.ts";
import type { TypingState } from "../romaji/typing.ts";
import type { GameEffect } from "./effects.ts";

// - idle       : 開始待ち。スペースキーでカウントダウンへ。
// - countdown  : 3 → 2 → 1 の秒読み。打鍵は無視。
// - playing    : 通常のタイピング進行。stats に打鍵の正誤数と開始時刻を持つ。
// - done       : 全問クリア後。結果画面に必要な統計と終了時刻を持つ。
export type GameState =
  | { phase: "idle" }
  | { phase: "countdown"; count: CountdownValue }
  | {
      phase: "playing";
      questionIndex: number;
      typingState: TypingState;
      cleared: boolean;
      stats: PlayingStats;
    }
  | { phase: "done"; stats: PlayingStats; endedAt: number };

export type CountdownValue = 3 | 2 | 1;

// playing 中に積み上げる統計。
// - correctKeys : typeKey が correct=true を返した打鍵の総数（モーラ確定の有無に関わらず1ずつ加算）。
// - wrongKeys   : typeKey が correct=false を返した打鍵の総数。
// - startedAt   : countdown 完了 → playing 開始の瞬間の時刻（ms）。done での経過時間計算の起点。
export type PlayingStats = {
  correctKeys: number;
  wrongKeys: number;
  startedAt: number;
};

// GameEvent は「いつ発生したか」を now(ms) として持ち込む。
// transition は純粋関数のまま時刻を扱うための唯一の入口で、
// 実行側（useTypingGame の send / setTimeout コールバック）で Date.now() を焼き込む。
// restart だけは done → idle のリセットに時刻を使わないので now を持たない。
export type GameEvent =
  | { type: "key"; key: string; now: number } // 小文字化済みの 1 文字
  | { type: "tick"; now: number } // カウントダウンを 1 段進める
  | { type: "advance"; now: number } // クリア演出終了 → 次の問題（または done）へ
  | { type: "restart" }; // done → idle

export type TransitionResult = { state: GameState; effects: GameEffect[] };

// カウントダウンの開始値。
export const COUNTDOWN_START: CountdownValue = 3;
// カウントダウン 1 段あたりの表示時間。
export const COUNTDOWN_STEP_MS = 1000;
// クリア演出を挟む時間。この間は入力を無視し、演出のあとに次の問題へ進める。
export const CLEAR_DELAY_MS = 600;
// idle からの開始トリガー / done からのリスタートトリガー。event.key の値で比較する。
export const START_KEY = " ";

export function createInitialState(): GameState {
  return { phase: "idle" };
}

// questions[index] の問題で playing に入る TransitionResult を作る。
// countdown 完了時（questions[0] から開始）と advance 時（questions[nextIndex] へ進む）が
// 同じ構築ロジックを必要とするための共通ヘルパー。
function enterQuestion(
  questions: readonly Question[],
  index: number,
  stats: PlayingStats,
): TransitionResult {
  return {
    state: {
      phase: "playing",
      questionIndex: index,
      typingState: createTypingState(questions[index].kana),
      cleared: false,
      stats,
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
      // 1 の次はゲーム開始。ここが計測開始点で、startedAt を焼き込む。
      return enterQuestion(questions, 0, {
        correctKeys: 0,
        wrongKeys: 0,
        startedAt: event.now,
      });
    }

    case "playing": {
      if (event.type === "advance") {
        // クリア演出タイマー経由でしか来ない想定だが、cleared 以外は無視する。
        if (!state.cleared) return { state, effects: [] };
        const nextIndex = state.questionIndex + 1;
        if (nextIndex >= questions.length) {
          // 最終問題クリア → done。endedAt は最後の advance の now を採用する。
          return {
            state: { phase: "done", stats: state.stats, endedAt: event.now },
            effects: [],
          };
        }
        return enterQuestion(questions, nextIndex, state.stats);
      }

      if (event.type !== "key") return { state, effects: [] };
      // クリア演出中は打鍵を握り潰す。cleared 中の打鍵は統計にも含めない。
      if (state.cleared) return { state, effects: [] };

      const result = typeKey(state.typingState, event.key);
      if (!result.correct) {
        return {
          state: { ...state, stats: { ...state.stats, wrongKeys: state.stats.wrongKeys + 1 } },
          effects: [{ type: "playSound", sound: "error" }],
        };
      }
      const nextStats: PlayingStats = {
        ...state.stats,
        correctKeys: state.stats.correctKeys + 1,
      };
      if (!isFinished(result.state)) {
        return {
          state: { ...state, typingState: result.state, stats: nextStats },
          effects: [{ type: "playSound", sound: "page" }],
        };
      }
      // ここで questionIndex を進めず、演出を挟むために cleared だけ立てる。
      return {
        state: { ...state, typingState: result.state, cleared: true, stats: nextStats },
        effects: [
          { type: "playSound", sound: "page" },
          { type: "playSound", sound: "success" },
          { type: "schedule", event: { type: "advance" }, delayMs: CLEAR_DELAY_MS },
        ],
      };
    }

    case "done": {
      // 結果画面からの「もういちど」で idle に戻る。ボタン経由の restart と
      // キーボードからの START_KEY（idle と対称的に Space で再開）を同一に扱う。
      if (event.type === "restart") {
        return { state: createInitialState(), effects: [] };
      }
      if (event.type === "key" && event.key === START_KEY) {
        return { state: createInitialState(), effects: [] };
      }
      return { state, effects: [] };
    }
  }
}

import { useEffect, useReducer } from "react";
import type { Question } from "../data/questions.ts";
import { createTypingState, isFinished, romajiDisplay, typeKey } from "./romaji.ts";
import type { TypingState } from "./romaji.ts";

// ゲームの進行フェーズを discriminated union で表現する。
// - idle       : 開始待ち。スペースキーでカウントダウンへ。
// - countdown  : 3 → 2 → 1 の秒読み。打鍵は無視。
// - playing    : 通常のタイピング進行。question / typed / next / rest が存在する。
// - done       : 全問クリア後。
export type TypingGameState =
  | { phase: "idle"; total: number }
  | { phase: "countdown"; total: number; count: CountdownValue }
  | {
      phase: "playing";
      total: number;
      questionIndex: number;
      question: Question;
      typed: string;
      // 次に打つ 1 文字。cleared 中は "" になる。
      next: string;
      rest: string;
      // 1 問クリア直後の演出中フラグ。この間は入力を受け付けない。
      cleared: boolean;
    }
  | { phase: "done"; total: number };

// カウントダウンで表示する秒数。開始は 3 固定。
export type CountdownValue = 3 | 2 | 1;
const COUNTDOWN_START: CountdownValue = 3;
// カウントダウン 1 段あたりの表示時間。
const COUNTDOWN_STEP_MS = 1000;
// クリア演出を挟む時間。この間は入力を無視し、演出のあとに次の問題へ進める。
const CLEAR_DELAY_MS = 600;
// idle からの開始トリガー。event.key の値で比較する。
const START_KEY = " ";

type InternalState =
  | { phase: "idle" }
  | { phase: "countdown"; count: CountdownValue }
  | { phase: "playing"; questionIndex: number; typingState: TypingState; cleared: boolean }
  | { phase: "done" };

type Action = { type: "key"; key: string } | { type: "tick" } | { type: "advance" };

// 出題リストを引き取り、キーボード入力を購読して状態を進めるフック。
// useReducer で状態遷移を局所化し、window リスナーはマウント時に一度だけ張る。
// dispatch は安定した関数のため deps が空でも常に最新の reducer 経由で動く。
export function useTypingGame(questions: readonly Question[]): TypingGameState {
  const [state, dispatch] = useReducer(
    (state: InternalState, action: Action): InternalState => {
      switch (state.phase) {
        case "idle":
          // スペース以外の打鍵と時間経過は無視。開始トリガーだけを受け付ける。
          if (action.type === "key" && action.key === START_KEY) {
            return { phase: "countdown", count: COUNTDOWN_START };
          }
          return state;
        case "countdown":
          // カウントダウン中は打鍵を全て握り潰し、tick でのみ次段へ進む。
          if (action.type !== "tick") return state;
          if (state.count > 1) {
            return { phase: "countdown", count: (state.count - 1) as CountdownValue };
          }
          // 1 の次はゲーム開始。最初の問題の TypingState を作る。
          return {
            phase: "playing",
            questionIndex: 0,
            typingState: createTypingState(questions[0].kana),
            cleared: false,
          };
        case "playing": {
          if (action.type === "advance") {
            // 演出タイマー経由でしか来ない想定だが、念のため cleared 以外は無視。
            if (!state.cleared) return state;
            const nextIndex = state.questionIndex + 1;
            if (nextIndex >= questions.length) {
              return { phase: "done" };
            }
            return {
              phase: "playing",
              questionIndex: nextIndex,
              typingState: createTypingState(questions[nextIndex].kana),
              cleared: false,
            };
          }
          if (action.type !== "key") return state;
          // クリア演出中は打鍵を握り潰す。
          if (state.cleared) return state;
          const result = typeKey(state.typingState, action.key);
          if (!result.correct) return state;
          if (!isFinished(result.state)) {
            return { ...state, typingState: result.state };
          }
          // ここで questionIndex を進めず、演出を挟むために cleared だけ立てる。
          return { ...state, typingState: result.state, cleared: true };
        }
        case "done":
          return state;
      }
    },
    undefined,
    (): InternalState => ({ phase: "idle" }),
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      // スペースはブラウザのページスクロールを誘発するため、常に抑止する。
      // idle では開始トリガー、playing では未使用の打鍵として扱うが、いずれもスクロールされたくない。
      if (event.key === START_KEY) event.preventDefault();
      // CapsLock や Shift 時の大文字も正しく判定できるよう小文字に正規化する。
      dispatch({ type: "key", key: event.key.toLowerCase() });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // カウントダウンの秒読み。count が変わるたびにタイマーを張り直す
  // （state.phase だけを deps にすると 3→2→1 の切り替わりで発火しない）。
  const countdownCount = state.phase === "countdown" ? state.count : null;
  useEffect(() => {
    if (countdownCount === null) return;
    const timer = setTimeout(() => dispatch({ type: "tick" }), COUNTDOWN_STEP_MS);
    return () => clearTimeout(timer);
  }, [countdownCount]);

  // cleared が立ったら CLEAR_DELAY_MS 後に次の問題へ。
  // アンマウントや途中で状態が変わったときは確実にタイマーを片付ける。
  const clearedPending = state.phase === "playing" && state.cleared;
  useEffect(() => {
    if (!clearedPending) return;
    const timer = setTimeout(() => dispatch({ type: "advance" }), CLEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [clearedPending]);

  const total = questions.length;
  switch (state.phase) {
    case "idle":
      return { phase: "idle", total };
    case "countdown":
      return { phase: "countdown", total, count: state.count };
    case "done":
      return { phase: "done", total };
    case "playing": {
      const { typed, remaining } = romajiDisplay(state.typingState);
      return {
        phase: "playing",
        total,
        questionIndex: state.questionIndex,
        question: questions[state.questionIndex],
        typed,
        next: remaining.charAt(0),
        rest: remaining.slice(1),
        cleared: state.cleared,
      };
    }
  }
}

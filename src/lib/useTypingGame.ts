import { useEffect, useReducer } from "react";
import type { Question } from "../data/questions.ts";
import { createTypingState, isFinished, romajiDisplay, typeKey } from "./romaji.ts";
import type { TypingState } from "./romaji.ts";

// ゲームの状態を discriminated union で表現する。
// done: true のときは question / typed / next / rest が存在しないことが型で保証される。
export type TypingGameState =
  | { done: true }
  | {
      done: false;
      // 1 問クリア直後の演出中フラグ。この間は入力を受け付けない。
      cleared: boolean;
      questionIndex: number;
      total: number;
      question: Question;
      typed: string;
      // 次に打つ 1 文字。cleared 中は "" になる。
      next: string;
      rest: string;
    };

// クリア演出を挟む時間。この間は入力を無視し、演出のあとに次の問題へ進める。
const CLEAR_DELAY_MS = 600;

type InternalState = {
  questionIndex: number;
  typingState: TypingState;
  cleared: boolean;
};

type Action = { type: "key"; key: string } | { type: "advance" };

// 出題リストを引き取り、キーボード入力を購読して状態を進めるフック。
// useReducer で状態遷移を局所化し、window リスナーはマウント時に一度だけ張る。
// dispatch は安定した関数のため deps が空でも常に最新の reducer 経由で動く。
export function useTypingGame(questions: readonly Question[]): TypingGameState {
  const [state, dispatch] = useReducer(
    (state: InternalState, action: Action): InternalState => {
      if (action.type === "advance") {
        // 演出タイマー経由でしか来ない想定だが、念のため cleared 以外は無視。
        if (!state.cleared) return state;
        const nextIndex = state.questionIndex + 1;
        if (nextIndex >= questions.length) {
          return { ...state, questionIndex: nextIndex, cleared: false };
        }
        return {
          questionIndex: nextIndex,
          typingState: createTypingState(questions[nextIndex].kana),
          cleared: false,
        };
      }
      // クリア演出中は打鍵を握り潰す。
      if (state.cleared) return state;
      if (state.questionIndex >= questions.length) return state;
      const result = typeKey(state.typingState, action.key);
      if (!result.correct) return state;
      if (!isFinished(result.state)) {
        return { ...state, typingState: result.state };
      }
      // ここで questionIndex を進めず、演出を挟むために cleared だけ立てる。
      return { ...state, typingState: result.state, cleared: true };
    },
    questions,
    (qs): InternalState => ({
      questionIndex: 0,
      typingState: createTypingState(qs[0].kana),
      cleared: false,
    }),
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      // CapsLock や Shift 時の大文字も正しく判定できるよう小文字に正規化する。
      dispatch({ type: "key", key: event.key.toLowerCase() });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // cleared が立ったら CLEAR_DELAY_MS 後に次の問題へ。
  // アンマウントや途中で状態が変わったときは確実にタイマーを片付ける。
  useEffect(() => {
    if (!state.cleared) return;
    const timer = setTimeout(() => dispatch({ type: "advance" }), CLEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.cleared]);

  const total = questions.length;
  if (state.questionIndex >= total) {
    return { done: true };
  }
  const { typed, remaining } = romajiDisplay(state.typingState);
  return {
    done: false,
    cleared: state.cleared,
    questionIndex: state.questionIndex,
    total,
    question: questions[state.questionIndex],
    typed,
    next: remaining.charAt(0),
    rest: remaining.slice(1),
  };
}

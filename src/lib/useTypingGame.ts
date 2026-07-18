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
      questionIndex: number;
      total: number;
      question: Question;
      typed: string;
      // 次に打つ 1 文字。done: false の間は必ず 1 文字入っている。
      next: string;
      rest: string;
    };

type InternalState = {
  questionIndex: number;
  typingState: TypingState;
};

type Action = { type: "key"; key: string };

// 出題リストを引き取り、キーボード入力を購読して状態を進めるフック。
// useReducer で状態遷移を局所化し、window リスナーはマウント時に一度だけ張る。
// dispatch は安定した関数のため deps が空でも常に最新の reducer 経由で動く。
export function useTypingGame(questions: readonly Question[]): TypingGameState {
  const [state, dispatch] = useReducer(
    (state: InternalState, action: Action): InternalState => {
      if (state.questionIndex >= questions.length) return state;
      const result = typeKey(state.typingState, action.key);
      if (!result.correct) return state;
      if (!isFinished(result.state)) {
        return { ...state, typingState: result.state };
      }
      const nextIndex = state.questionIndex + 1;
      if (nextIndex >= questions.length) {
        return { ...state, questionIndex: nextIndex };
      }
      return {
        questionIndex: nextIndex,
        typingState: createTypingState(questions[nextIndex].kana),
      };
    },
    questions,
    (qs): InternalState => ({
      questionIndex: 0,
      typingState: createTypingState(qs[0].kana),
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

  const total = questions.length;
  if (state.questionIndex >= total) {
    return { done: true };
  }
  const { typed, remaining } = romajiDisplay(state.typingState);
  return {
    done: false,
    questionIndex: state.questionIndex,
    total,
    question: questions[state.questionIndex],
    typed,
    next: remaining.charAt(0),
    rest: remaining.slice(1),
  };
}

// GameState から表示用の値を導出する純粋な射影。React 側はこの GameView だけを見ればよい。

import type { Question } from "../questions/types.ts";
import { romajiDisplay } from "../romaji/typing.ts";
import type { CountdownValue, GameState } from "./machine.ts";

export type GameView =
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

export function selectView(state: GameState, questions: readonly Question[]): GameView {
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

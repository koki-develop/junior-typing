import type { Question } from "../data/questions.ts";
import { Keyboard } from "./Keyboard.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import { QuestionDisplay } from "./QuestionDisplay.tsx";

type Props = {
  questionIndex: number;
  total: number;
  question: Question;
  typed: string;
  next: string;
  rest: string;
};

// 進捗 → 問題 → 鍵盤ヒントの 3 段を縦に並べる、プレイ中の主画面。
export function TypingScreen({ questionIndex, total, question, typed, next, rest }: Props) {
  return (
    <div className="grid place-items-center gap-16">
      <ProgressBar total={total} currentIndex={questionIndex} />
      <QuestionDisplay
        kana={question.kana}
        text={question.text}
        typed={typed}
        next={next}
        rest={rest}
      />
      <Keyboard activeKey={next || null} />
    </div>
  );
}

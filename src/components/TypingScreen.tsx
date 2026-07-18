import type { Question } from "../data/questions.ts";
import type { CountdownValue } from "../lib/useTypingGame.ts";
import { CountdownMessage } from "./CountdownMessage.tsx";
import { IdleMessage } from "./IdleMessage.tsx";
import { Keyboard } from "./Keyboard.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import { QuestionDisplay } from "./QuestionDisplay.tsx";

// 中央スロットに差し込むコンテンツ。フェーズごとに切り替える。
// playing 以外では ProgressBar の進捗と Keyboard の強調キーは静止表示になる。
export type PlayfieldContent =
  | { kind: "idle" }
  | { kind: "countdown"; count: CountdownValue }
  | {
      kind: "playing";
      questionIndex: number;
      question: Question;
      typed: string;
      next: string;
      rest: string;
      // 直前の 1 問をクリアして次の問題を出すまでの演出中フラグ。
      cleared: boolean;
    };

type Props = {
  total: number;
  content: PlayfieldContent;
};

// 進捗 → 中央 → 鍵盤ヒントの 3 段を縦に並べるゲーム画面のシェル。
// 中央スロットだけ idle / countdown / playing で差し替えることで、
// フェーズ遷移中に周囲のレイアウトが跳ねないようにする。
export function TypingScreen({ total, content }: Props) {
  const currentIndex = content.kind === "playing" ? content.questionIndex : 0;
  const activeKey = content.kind === "playing" ? content.next || null : null;
  return (
    <div className="grid place-items-center gap-16">
      <ProgressBar total={total} currentIndex={currentIndex} />
      <PlayfieldCenter content={content} />
      <Keyboard activeKey={activeKey} />
    </div>
  );
}

function PlayfieldCenter({ content }: { content: PlayfieldContent }) {
  switch (content.kind) {
    case "idle":
      return <IdleMessage />;
    case "countdown":
      return <CountdownMessage count={content.count} />;
    case "playing":
      return (
        <QuestionDisplay
          kana={content.question.kana}
          text={content.question.text}
          typed={content.typed}
          next={content.next}
          rest={content.rest}
          cleared={content.cleared}
        />
      );
  }
}

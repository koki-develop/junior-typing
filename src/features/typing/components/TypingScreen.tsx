import type { GameView } from "../../../domain/game/view.ts";
import { CountdownMessage } from "./CountdownMessage.tsx";
import { IdleMessage } from "./IdleMessage.tsx";
import { Keyboard } from "./Keyboard.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import { QuestionDisplay } from "./QuestionDisplay.tsx";

type Props = {
  // done は呼び出し側（App）で分岐済みなので、ここでは扱わない。
  view: Exclude<GameView, { phase: "done" }>;
};

// 進捗 → 中央 → 鍵盤ヒントの 3 段を縦に並べるゲーム画面のシェル。
// 中央スロットだけ idle / countdown / playing で差し替えることで、
// フェーズ遷移中に周囲のレイアウトが跳ねないようにする。
export function TypingScreen({ view }: Props) {
  const currentIndex = view.phase === "playing" ? view.questionIndex : 0;
  const activeKey = view.phase === "playing" ? view.next || null : null;
  return (
    <div className="grid place-items-center gap-16">
      <ProgressBar total={view.total} currentIndex={currentIndex} />
      {/* aria-live 領域は「マウント時点で既に入っていた内容」を読み上げない。
          countdown フェーズで初めてマウントされる CountdownMessage の中に置くと、
          最初の "3" が読み上げ対象の変化として検出されず落ちてしまう。
          idle の時点から空文字で常時マウントしておくことで、"" → "3" という
          差分が確実に発生し、最初の秒読みも読み上げられる。 */}
      <span aria-atomic="true" aria-live="assertive" className="sr-only">
        {view.phase === "countdown" ? view.count : ""}
      </span>
      <PlayfieldCenter view={view} />
      <Keyboard activeKey={activeKey} />
    </div>
  );
}

function PlayfieldCenter({ view }: Props) {
  switch (view.phase) {
    case "idle":
      return <IdleMessage />;
    case "countdown":
      return <CountdownMessage count={view.count} />;
    case "playing":
      return (
        <QuestionDisplay
          kana={view.question.kana}
          text={view.question.text}
          typed={view.typed}
          next={view.next}
          rest={view.rest}
          cleared={view.cleared}
        />
      );
  }
}

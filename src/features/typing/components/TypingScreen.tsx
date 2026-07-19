import type { GameView } from "../../../domain/game/view.ts";
import { CountdownMessage } from "./CountdownMessage.tsx";
import { IdleMessage } from "./IdleMessage.tsx";
import { Keyboard } from "./Keyboard.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import { QuestionDisplay } from "./QuestionDisplay.tsx";

type Props = {
  // done は呼び出し側（App）で分岐済みなので、ここでは扱わない。
  view: Exclude<GameView, { phase: "done" }>;
  // idle 中の IdleMessage に表示する QuestionSet.title。
  title: string;
};

// 進捗 → 中央 → 鍵盤ヒントの 3 段を縦に並べるゲーム画面のシェル。
// 中央スロットだけ idle / countdown / playing で差し替えることで、
// フェーズ遷移中に周囲のレイアウトが跳ねないようにする。
export function TypingScreen({ view, title }: Props) {
  // 1 問目のセグメントが「アクティブ」になるのは countdown 終了後に playing へ入ってから。
  // idle / countdown では null を渡し、進捗バーは全セグメント remaining のまま静止する。
  const currentIndex = view.phase === "playing" ? view.questionIndex : null;
  // クリア演出中（cleared=true の CLEAR_DELAY_MS）は現在セグメントを左→右に塗り上げる。
  const filling = view.phase === "playing" && view.cleared;
  const activeKey =
    view.phase === "playing" ? view.next || null : view.phase === "idle" ? "space" : null;
  return (
    // App.tsx の main と同じ理由で grid-cols を minmax(0,1fr) に固定し、
    // Keyboard（800px 幅）の max-content で列が広がらないようにする。
    <div className="grid grid-cols-[minmax(0,1fr)] place-items-center gap-16">
      <ProgressBar total={view.total} currentIndex={currentIndex} filling={filling} />
      {/* aria-live 領域は「マウント時点で既に入っていた内容」を読み上げない。
          countdown フェーズで初めてマウントされる CountdownMessage の中に置くと、
          最初の "3" が読み上げ対象の変化として検出されず落ちてしまう。
          idle の時点から空文字で常時マウントしておくことで、"" → "3" という
          差分が確実に発生し、最初の秒読みも読み上げられる。 */}
      <span aria-atomic="true" aria-live="assertive" className="sr-only">
        {view.phase === "countdown" ? view.count : ""}
      </span>
      <PlayfieldCenter view={view} title={title} />
      <Keyboard activeKey={activeKey} />
    </div>
  );
}

function PlayfieldCenter({ view, title }: Props) {
  switch (view.phase) {
    case "idle":
      return <IdleMessage title={title} />;
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

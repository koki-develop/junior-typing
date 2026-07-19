import { useParams } from "@tanstack/react-router";
import { findQuestionSet } from "../domain/questions/questions.ts";
import { ResultScreen } from "../features/typing/components/ResultScreen.tsx";
import { TypingScreen } from "../features/typing/components/TypingScreen.tsx";
import { useTypingGame } from "../features/typing/useTypingGame.ts";

// /play/$setId のプレイ画面。setId → QuestionSet の解決は router.ts の beforeLoad で済んでおり、
// 存在しない setId は / に redirect されているため、ここに来る時点で findQuestionSet は必ず解決する。
export function PlayPage() {
  const { setId } = useParams({ from: "/play/$setId" });
  const questionSet = findQuestionSet(setId);
  if (!questionSet) {
    // beforeLoad のガードを潜り抜けたら開発時のバグ。null で描画を止め、テスト/ビルドを壊す。
    throw new Error(`unreachable: questionSet not found for setId=${setId}`);
  }

  const { view, restart } = useTypingGame(questionSet.questions);

  return (
    // grid-cols を明示しないと暗黙の列が子（Keyboard の 800px 幅）の max-content に合わせて広がり、
    // 画面幅より狭いビューポートでページ全体が横スクロールしてしまう。minmax(0,1fr) で列幅を
    // 利用可能スペースに固定し、Keyboard 側の縮小スケーリングが機能する余地を作る。
    <main className="grid min-h-screen grid-cols-[minmax(0,1fr)] place-items-center bg-canvas px-6 py-16 font-round text-ink">
      {view.phase === "done" ? (
        <ResultScreen result={view.result} onRestart={restart} />
      ) : (
        <TypingScreen view={view} />
      )}
    </main>
  );
}

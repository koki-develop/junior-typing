import { questions } from "../domain/questions/questions.ts";
import { ResultScreen } from "../features/typing/components/ResultScreen.tsx";
import { TypingScreen } from "../features/typing/components/TypingScreen.tsx";
import { useTypingGame } from "../features/typing/useTypingGame.ts";

function App() {
  const { view, restart } = useTypingGame(questions);

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

export default App;

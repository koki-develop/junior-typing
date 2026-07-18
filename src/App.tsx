import { CompletionScreen } from "./components/CompletionScreen.tsx";
import type { PlayfieldContent } from "./components/TypingScreen.tsx";
import { TypingScreen } from "./components/TypingScreen.tsx";
import { questions } from "./data/questions.ts";
import { useTypingGame } from "./lib/useTypingGame.ts";

function App() {
  const game = useTypingGame(questions);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-16 font-round text-ink">
      {game.phase === "done" ? (
        <CompletionScreen />
      ) : (
        <TypingScreen total={game.total} content={toContent(game)} />
      )}
    </main>
  );
}

// TypingGameState から TypingScreen 用の中央スロット prop へ射影する。
// phase が done のときはこの関数の呼び出し側で分岐済み。
function toContent(
  game: Exclude<ReturnType<typeof useTypingGame>, { phase: "done" }>,
): PlayfieldContent {
  switch (game.phase) {
    case "idle":
      return { kind: "idle" };
    case "countdown":
      return { kind: "countdown", count: game.count };
    case "playing":
      return {
        kind: "playing",
        questionIndex: game.questionIndex,
        question: game.question,
        typed: game.typed,
        next: game.next,
        rest: game.rest,
        cleared: game.cleared,
      };
  }
}

export default App;

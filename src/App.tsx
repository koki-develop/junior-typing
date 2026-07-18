import { CompletionScreen } from "./components/CompletionScreen.tsx";
import { TypingScreen } from "./components/TypingScreen.tsx";
import { questions } from "./data/questions.ts";
import { useTypingGame } from "./lib/useTypingGame.ts";

function App() {
  const game = useTypingGame(questions);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-16 font-round text-ink">
      {game.done ? (
        <CompletionScreen />
      ) : (
        <TypingScreen
          questionIndex={game.questionIndex}
          total={game.total}
          question={game.question}
          typed={game.typed}
          next={game.next}
          rest={game.rest}
        />
      )}
    </main>
  );
}

export default App;

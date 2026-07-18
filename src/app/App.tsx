import { questions } from "../domain/questions/questions.ts";
import { CompletionScreen } from "../features/typing/components/CompletionScreen.tsx";
import { TypingScreen } from "../features/typing/components/TypingScreen.tsx";
import { useTypingGame } from "../features/typing/useTypingGame.ts";

function App() {
  const view = useTypingGame(questions);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-16 font-round text-ink">
      {view.phase === "done" ? <CompletionScreen /> : <TypingScreen view={view} />}
    </main>
  );
}

export default App;

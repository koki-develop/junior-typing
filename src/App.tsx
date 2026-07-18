import { useEffect, useState } from "react";
import { questions } from "./data/questions";
import { createTypingState, isFinished, romajiDisplay, typeKey } from "./lib/romaji";
import type { TypingState } from "./lib/romaji";

function App() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [typingState, setTypingState] = useState<TypingState>(() =>
    createTypingState(questions[0].kana),
  );

  const done = questionIndex >= questions.length;

  useEffect(() => {
    if (done) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;

      const result = typeKey(typingState, event.key);
      if (!result.correct) return;

      if (isFinished(result.state)) {
        const nextIndex = questionIndex + 1;
        setQuestionIndex(nextIndex);
        if (nextIndex < questions.length) {
          setTypingState(createTypingState(questions[nextIndex].kana));
        }
      } else {
        setTypingState(result.state);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [done, questionIndex, typingState]);

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-3xl font-bold">終了！おつかれさまでした</p>
      </main>
    );
  }

  const question = questions[questionIndex];
  const romaji = romajiDisplay(typingState);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <p className="text-gray-500">
        {questionIndex + 1} / {questions.length}
      </p>
      <p className="text-4xl font-bold">{question.text}</p>
      <p className="text-xl text-gray-500">{question.kana}</p>
      <p className="font-mono text-2xl">
        <span className="text-gray-400">{romaji.typed}</span>
        <span className="underline">{romaji.remaining}</span>
      </p>
    </main>
  );
}

export default App;

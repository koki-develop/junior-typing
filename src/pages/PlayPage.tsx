import { useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { findQuestionSet } from "../domain/questions/questions.ts";
import { selectQuestions } from "../domain/questions/select.ts";
import type { Question } from "../domain/questions/types.ts";
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

  // questionSet.questions は出題プール。実際にプレイするのは questionCount 件のランダム抽出
  // （順序も含めてシャッフル済み）で、初回マウント時に一度だけ選ぶ。questionSet は
  // questionSets 内の同一要素への参照なので setId が同じ限り安定している
  // （router.ts の playRoute に remountDeps: ({ params }) => params を設定しているため、
  // setId が変わるとこのコンポーネント自体が丸ごとマウントし直され、questionSet がこの
  // コンポーネントの生存期間中に変わることはない）。
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() =>
    selectQuestions(questionSet.questions, questionSet.questionCount),
  );
  const { view, restart } = useTypingGame(activeQuestions);

  // done → idle への遷移（「もういちど」ボタン・done 中の Space キーのいずれの経路でも
  // view.phase は "idle" になる）でだけ出題を引き直す。前回描画時の phase を
  // previousPhaseRef に持つことで「直前が idle 以外だった」ときだけ発火させ、初回マウント
  // （初期状態から既に idle）で useState の初期抽選をもう一度やり直す無駄を避ける。
  // 依存配列を [view.phase, questionSet] に絞ることで、"playing" 中の再レンダー（phase
  // 自体は変わらない）のたびに ref 書き込みだけの空振り実行が走るのも防ぐ。
  const previousPhaseRef = useRef(view.phase);
  useEffect(() => {
    if (view.phase === "idle" && previousPhaseRef.current !== "idle") {
      setActiveQuestions(selectQuestions(questionSet.questions, questionSet.questionCount));
    }
    previousPhaseRef.current = view.phase;
  }, [view.phase, questionSet]);

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

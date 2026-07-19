import { Link, useParams } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { findQuestionSet } from "../domain/questions/questions.ts";
import { selectQuestions } from "../domain/questions/select.ts";
import type { Question } from "../domain/questions/types.ts";
import { ResultScreen } from "../features/typing/components/ResultScreen.tsx";
import { TypingScreen } from "../features/typing/components/TypingScreen.tsx";
import { useTypingGame } from "../features/typing/useTypingGame.ts";

// done ↔ プレイ中の切り替え時のフェード時間。フェードアウト → フェードインの合計時間は
// この定数の2倍（AnimatePresence の mode="wait" で直列に走るため）。
const FADE_DURATION_SEC = 0.25;

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
    // header 行 + main 行の 2 段。main 側は残り高さいっぱいを取り、その中で place-items-center
    // することで、header の高さぶん重心が少し下がるだけで従来どおり中央にゲーム内容を置ける。
    // header はプレイ中・結果画面のどちらでも同じ位置に描かれるので、戻る導線が常時同じ場所にある。
    <div className="grid min-h-screen grid-rows-[auto_1fr] bg-canvas font-round text-ink">
      <header className="px-6 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-lg text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span aria-hidden="true">←</span>
          <span>もどる</span>
        </Link>
      </header>
      {/* grid-cols を明示しないと暗黙の列が子（Keyboard の 800px 幅）の max-content に合わせて広がり、
          画面幅より狭いビューポートでページ全体が横スクロールしてしまう。minmax(0,1fr) で列幅を
          利用可能スペースに固定し、Keyboard 側の縮小スケーリングが機能する余地を作る。 */}
      <main className="grid grid-cols-1 place-items-center px-6 pb-16">
        {/* done ↔ プレイ中の切り替え時にフェードアウト → フェードインで切り替える。
            mode="wait" で先に古い方が消え切ってから新しい方を出すことで、両画面が重なる瞬間を作らない。
            initial={false} は初回マウント（idle）でフェードインを走らせないための指定で、
            初回描画は既存挙動どおり即時に出す。ヘッダの「もどる」リンクはこの main の外側に
            あるので、フェード中も常に同じ位置に表示され続ける。
            key は "typing"（idle / countdown / playing）と "result"（done）の2値だけにしてあり、
            プレイ中のフェーズ切り替え（idle→countdown→playing）は AnimatePresence を跨がないので
            TypingScreen の内側の従来どおり瞬時に切り替わる。 */}
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={view.phase === "done" ? "result" : "typing"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FADE_DURATION_SEC, ease: "easeInOut" }}
          >
            {view.phase === "done" ? (
              <ResultScreen result={view.result} onRestart={restart} />
            ) : (
              <TypingScreen view={view} title={questionSet.title} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

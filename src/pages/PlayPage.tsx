import { Link, useParams } from "@tanstack/react-router";
import { AnimatePresence, domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState } from "react";
import { findQuestionSet } from "../domain/questions/questions.ts";
import { selectQuestions } from "../domain/questions/select.ts";
import type { Question } from "../domain/questions/types.ts";
import { ResultScreen } from "../features/typing/components/ResultScreen.tsx";
import { TypingScreen } from "../features/typing/components/TypingScreen.tsx";
import { useTypingGame } from "../features/typing/useTypingGame.ts";
import { evaluateHighScore, type HighScoreInfo, recordHighScore } from "../services/highScores.ts";

// done ↔ プレイ中の切り替え時のフェード時間。フェードアウト → フェードインの合計時間は
// この定数の2倍（AnimatePresence の mode="wait" で直列に走るため）。
const FADE_DURATION_SEC = 0.25;

// /play/$setId のプレイ画面。setId → QuestionSet の解決は router.tsx の beforeLoad で済んでおり、
// 存在しない setId は / に redirect されているため、ここに来る時点で findQuestionSet は必ず解決する。
export function PlayPage() {
  const { setId } = useParams({ from: "/play/$setId" });
  const questionSet = findQuestionSet(setId);
  if (!questionSet) {
    // beforeLoad のガードを潜り抜けたら開発時のバグ。null で描画を止め、テスト/ビルドを壊す。
    throw new Error(`unreachable: questionSet not found for setId=${setId}`);
  }

  // questionSet.questions は出題プール。実際にプレイするのは questionCount 件を抽出したもので、
  // 抽出と並び順の挙動は questionSet.randomOrder が決める（selectQuestions を参照）。
  // 初回マウント時に一度だけ選ぶ。questionSet は questionSets 内の同一要素への参照なので
  // setId が同じ限り安定している（router.tsx の playRoute に remountDeps: ({ params }) => params
  // を設定しているため、setId が変わるとこのコンポーネント自体が丸ごとマウントし直され、
  // questionSet がこのコンポーネントの生存期間中に変わることはない）。
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() =>
    selectQuestions(questionSet.questions, questionSet.questionCount, questionSet.randomOrder),
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
      setActiveQuestions(
        selectQuestions(questionSet.questions, questionSet.questionCount, questionSet.randomOrder),
      );
    }
    previousPhaseRef.current = view.phase;
  }, [view.phase, questionSet]);

  // done 到達時のハイスコア表示に必要な情報（新記録判定 + 前回スコア）を、
  // ResultScreen の初回描画に間に合う形で保持する。
  //
  // 読み取り（判定）と書き込み（永続化）で責務を明確に分ける:
  //   - render 中の derived state では evaluateHighScore（純関数版）を使い、
  //     副作用ゼロで highScoreInfo を確定する。ResultScreen が初めて描画される
  //     tick で既に prop が入っているので、モーションの delay 計算がマウント時刻
  //     に張り付き、「ハイスコア！」バッジのタイミングがカウントアップ完了と
  //     きっちり噛み合う（useEffect 経由だと 1 tick 遅れて timing がズレる）。
  //   - useEffect では recordHighScore を呼んで localStorage に書き込む。
  //     こちらは commit 後に走るので UI の初期描画には影響しない。
  //
  // なぜ render 中で recordHighScore を直接呼ばないのか（過去に踏んだ罠）:
  //   recordHighScore は「書き込み」と「新記録判定」を同時に行うため、React Strict
  //   Mode の double-invoke で render が 2 回呼ばれると、1 回目の書き込みが 2 回目の
  //   判定結果を反転させる（1 回目: isNewHigh=true、2 回目: 既に書き込まれた値と比較
  //   して isNewHigh=false）。2 回目の setState が commit されて、dev ビルドの初回
  //   完走で「新記録なのにバッジが出ずに『ハイスコア N』が出る」現象が発生していた。
  //   evaluateHighScore は副作用が無いので Strict Mode でも判定結果が反転しない。
  //   useEffect 内の recordHighScore は Strict Mode で 2 回発火するが、書き込み自体
  //   は冪等（同一 score の再書き込みは値が変わらない）で観測可能な副作用は無い。
  //
  // done phase 中はスコアが不変なので lastDoneScore と一致し続け、判定の再計算は
  // 起きない。「もういちど」で done → idle に戻ると doneScore が null に戻り、
  // highScoreInfo も null にクリアされる。次に done へ入ったときは新しいスコアで
  // 判定と書き込みが再度走る。
  const doneScore = view.phase === "done" ? view.result.score : null;
  const [lastDoneScore, setLastDoneScore] = useState<number | null>(null);
  const [highScoreInfo, setHighScoreInfo] = useState<HighScoreInfo | null>(null);
  if (doneScore !== lastDoneScore) {
    setLastDoneScore(doneScore);
    setHighScoreInfo(doneScore === null ? null : evaluateHighScore(setId, doneScore));
  }
  useEffect(() => {
    if (doneScore === null) return;
    recordHighScore(setId, doneScore);
  }, [doneScore, setId]);

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
        {/* motion は "motion" コンポーネント（全 features 同梱で ~34kb）ではなく、tree-shakable な
            "m"（motion/react-m）+ LazyMotion に features を渡す構成で使う。domAnimation は
            アニメーション・variants・enter/exit・tap/hover/focus をカバーし、drag/layout は含めない
            （本アプリでは未使用）。strict を付けると LazyMotion 配下で motion.X を使うとエラーで
            落ちるため、将来「うっかり full motion に戻す」変更を実行時に検知できる。
            LazyMotion はここ (PlayPage の main) にだけ置く: TopPage は motion 未使用なので上に
            持ち上げると TopPage の初期描画でも features 分の初期化コストを負ってしまう。
            ResultScreen 側の m.p / m.dd / m.span はここが祖先であることに依存している。 */}
        <LazyMotion features={domAnimation} strict>
          {/* done ↔ プレイ中の切り替え時にフェードアウト → フェードインで切り替える。
              mode="wait" で先に古い方が消え切ってから新しい方を出すことで、両画面が重なる瞬間を作らない。
              initial={false} は初回マウント（idle）でフェードインを走らせないための指定で、
              初回描画は既存挙動どおり即時に出す。ヘッダの「もどる」リンクはこの main の外側に
              あるので、フェード中も常に同じ位置に表示され続ける。
              key は "typing"（idle / countdown / playing）と "result"（done）の2値だけにしてあり、
              プレイ中のフェーズ切り替え（idle→countdown→playing）は AnimatePresence を跨がないので
              TypingScreen の内側の従来どおり瞬時に切り替わる。 */}
          <AnimatePresence initial={false} mode="wait">
            <m.div
              key={view.phase === "done" ? "result" : "typing"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: FADE_DURATION_SEC, ease: "easeInOut" }}
            >
              {view.phase === "done" ? (
                <ResultScreen
                  result={view.result}
                  highScoreInfo={highScoreInfo}
                  onRestart={restart}
                />
              ) : (
                <TypingScreen view={view} title={questionSet.title} />
              )}
            </m.div>
          </AnimatePresence>
        </LazyMotion>
      </main>
    </div>
  );
}

import { animate, useMotionValue, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { useEffect } from "react";
import { type GameResult, isPerfectScore } from "../../../domain/game/score.ts";
import type { HighScoreInfo } from "../../../services/highScores.ts";
import { playSound } from "../../../services/sound.ts";

// 結果画面の登場アニメーションのタイミング定数。値は 1 か所にまとめて微調整しやすくしておく。
// - ラベル（うったキー / まちがえたキー / かかったじかん / スコア）は最初から表示。
// - 値だけを順番にフェードインさせて視線を上から下へ導いたあと、
//   最後にスコアをカウントアップさせて締める。
const STAT_FADE_INITIAL_DELAY_SEC = 0.3;
const STAT_FADE_STAGGER_SEC = 0.55;
const STAT_FADE_DURATION_SEC = 0.4;
// スコアのカウントアップは 3 つの値のフェードインが終わってから始める。
// 開始タイミング = 初期 delay + 3 番目の値の delay + フェード duration。
const SCORE_COUNTUP_DELAY_SEC =
  STAT_FADE_INITIAL_DELAY_SEC + STAT_FADE_STAGGER_SEC * 2 + STAT_FADE_DURATION_SEC;
const SCORE_COUNTUP_DURATION_SEC = 1.6;
// カウントアップのイージング。前半で一気に増えて後半でスッと最終値に収束する「見せ場」を作る。
// easeOut のような素直な曲線だと最後まで淡々と進みがち。ここでは expo out 相当の
// cubic-bezier で強い減速をかける（後半の残像でスコアが「決まった」感を演出）。
const SCORE_COUNTUP_EASE = [0.16, 1, 0.3, 1] as const;
// スコアの数字自体もカウントアップ開始と同時に一瞬でフェードインさせる。
// 開始時に「0」がドンと表示されて誤解を与えるのを避けるため、フェード完了までは半透明にしておく。
const SCORE_FADE_IN_DURATION_SEC = 0.2;

// ハイスコア関連の演出の登場タイミング。
// - 更新バッジ: カウントアップ完了と同時（sparkle の瞬間に "決まった" 感を作る）。
// - 前回ハイスコア行: バッジと違って「参考情報」なので、カウントアップの余韻が一瞬
//   落ち着いてから静かに fade in する。同時に出すと sparkle の視線集中を奪う。
const HIGH_SCORE_REVEAL_DELAY_SEC = SCORE_COUNTUP_DELAY_SEC + SCORE_COUNTUP_DURATION_SEC;
const PREVIOUS_HIGH_REVEAL_EXTRA_DELAY_SEC = 0.25;
const PREVIOUS_HIGH_FADE_DURATION_SEC = 0.4;

type Props = {
  result: GameResult;
  // ハイスコアの記録結果。done 到達時に PlayPage 側で recordHighScore を叩いた結果を
  // そのまま流し込む。null は「まだ done phase に達していない」ケース用の防衛値で、
  // 実運用上は PlayPage の derived state パターン（changing state during render）が
  // ResultScreen の初回描画までに必ず値を確定させる。
  highScoreInfo: HighScoreInfo | null;
  onRestart: () => void;
};

// 全問クリア後に表示する結果画面。
// スコアを大きく強調しつつ、小学生向けに漢字を控えたラベルで打鍵数・ミス数・時間を並べる。
// 「もういちど」ボタンでリスタート。キーボードでは Space でも再開できる（machine.ts の done で処理）。
//
// ハイスコア関連の分岐:
//   - 新記録時（isNewHigh=true）: スコアの上に「ハイスコア！」バッジ。
//     さらに満点（isPerfectScore）なら文言を「パーフェクト！」に切り替える。
//     カウントアップ完了と同時に spring で登場して達成感を演出する。
//   - 未更新時（isNewHigh=false）: stat 群の下に「ハイスコア N」を控えめに表示。
//     カウントアップの余韻が落ち着いてから静かに fade in する。
//   - highScoreInfo=null: 両方非表示。derived state が確定する前の防衛値であり、
//     通常運用では発生しない（PlayPage で render 同期に prop を確定させている）。
export function ResultScreen({ result, highScoreInfo, onRestart }: Props) {
  const isNewHigh = highScoreInfo?.isNewHigh === true;
  // isNewHigh=true のときの previousHigh は "前回のハイスコア" だが、参考行として
  // 出すのは「更新できなかった」ケースだけ。isNewHigh の分岐で明確に切り出す。
  const previousHighToShow =
    highScoreInfo !== null && !highScoreInfo.isNewHigh ? highScoreInfo.previousHigh : null;
  // 「パーフェクト！」への切り替えは「今回のスコアが満点」で判定する。
  // isNewHigh との組み合わせでのみ意味を持つ（未更新時はバッジ自体が出ない）。
  const perfect = isPerfectScore(result.score);
  return (
    <div className="grid place-items-center gap-10 text-center">
      <div className="grid place-items-center gap-2">
        {isNewHigh && <HighScoreBadge perfect={perfect} />}
        <p className="text-lg tracking-[0.28em] text-muted">スコア</p>
        {/* aria-label は最終値の固定文字列。カウントアップ中の途中値を読み上げさせない。
            opacity 0 でスタートさせて「開始時に 0 が大きく表示される」印象を避け、
            カウントアップ開始と同時に一瞬でフェードインさせる。 */}
        <m.p
          aria-label={`スコア ${result.score}`}
          className="font-mono text-7xl font-medium leading-none tracking-tight tabular-nums text-accent md:text-8xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: SCORE_COUNTUP_DELAY_SEC,
            duration: SCORE_FADE_IN_DURATION_SEC,
            ease: "easeOut",
          }}
        >
          <AnimatedScoreValue target={result.score} />
        </m.p>
      </div>

      <dl className="grid grid-cols-[auto_auto] gap-x-8 gap-y-3 text-xl md:text-2xl">
        <StatRow label="うったキー" value={`${result.totalKeys}`} order={0} />
        <StatRow label="まちがえたキー" value={`${result.wrongKeys}`} order={1} />
        <StatRow
          label="かかったじかん"
          value={formatSeconds(result.elapsedMs)}
          unit="びょう"
          order={2}
        />
      </dl>

      {previousHighToShow !== null && <PreviousHighRow value={previousHighToShow} />}

      <div className="grid place-items-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full bg-accent px-8 py-3 font-round text-2xl font-medium text-canvas transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          もういちど
        </button>
        <span className="text-muted">スペースキーでもう1回</span>
      </div>
    </div>
  );
}

// 新記録時にスコアラベルの上に出す「達成」バッジ。
// perfect=true のときは文言を「パーフェクト！」に切り替える（TopPage のパーフェクト
// 特別扱いと語彙を揃える）。星や絵文字は使わない（TopPage が絵文字回避で ★ 記号を
// 使っている一方、ここでは文字装飾を最小にして "文言 + アニメーション + accent 色" の
// 3 点で達成感を作る方針）。
// spring で scale 0.6 → 1.0 に飛び込ませる。stiffness/damping は「軽く弾んで止まる」
// 範囲でチューニング（damping を強くしすぎると "決まった" 感が失われ、弱すぎると
// うるさい）。カウントアップ完了と同時に登場して、sparkle 音の視覚フィニッシュを兼ねる。
// role="status" を付けているのは、更新結果を SR ユーザーにも短く伝えるため。
function HighScoreBadge({ perfect }: { perfect: boolean }) {
  const label = perfect ? "パーフェクト！" : "ハイスコア！";
  return (
    <m.p
      role="status"
      className="font-round text-2xl font-bold text-accent md:text-3xl"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay: HIGH_SCORE_REVEAL_DELAY_SEC,
        type: "spring",
        stiffness: 380,
        damping: 14,
      }}
    >
      {label}
    </m.p>
  );
}

// 未更新時に stat 群の下に控えめに出す「これまでのハイスコア」表示。
// トップページのカードと同じ "ハイスコア N" の語彙で揃える（未来の変更で片方だけ
// 表現が変わると、同じ値なのに違って見える）。数字は tabular-nums で桁揃え。
// バッジのような登場演出はせず、opacity fade だけで静かに現れる。
//
// ラベルと値を別 span に分けているのは、色分け（muted / ink）を独立させたい
// ことに加えて、テストで「ハイスコア」ラベルと数値をそれぞれ独立の leaf 要素
// として getByText で拾えるようにするため。同一 p 内でテキストノードとして
// 混在させると、playwright の text マッチが親テキスト "ハイスコアN" とぶつかる。
function PreviousHighRow({ value }: { value: number }) {
  return (
    <m.p
      className="text-lg md:text-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        delay: HIGH_SCORE_REVEAL_DELAY_SEC + PREVIOUS_HIGH_REVEAL_EXTRA_DELAY_SEC,
        duration: PREVIOUS_HIGH_FADE_DURATION_SEC,
        ease: "easeOut",
      }}
    >
      <span className="text-muted">ハイスコア</span>
      <span className="ml-2 font-mono font-medium tabular-nums text-ink">{value}</span>
    </m.p>
  );
}

// ラベルと値を dt/dd で並べる 1 行。ラベルは最初から表示、値だけを順番にフェードインさせる。
// order は 0 から始まる登場順。initial delay + order * stagger で timing を決める。
// dd は幅を tabular-nums で確保しているので、opacity だけ動かせばレイアウトはジャンプしない。
// unit は「かかったじかん」の「びょう」のように数字の外側にぶら下げたい単位。
// grid の col2 は各 dd の可視幅で auto sizing されるため、単位を absolute で右にオフセットすれば
// dd 自体の幅は数字だけで決まり、3 行の数字の右端が縦に揃う（単位は列の外にはみ出す）。
// フェード開始と同時に鳴らす chime も row 自身が予約する。行の増減で chime が自動追従し、
// delay 式が 1 か所にだけ書かれる（親側で `for (i < 3)` する形だとハードコード / 二重管理になる）。
// motion の onAnimationStart は delay の完了ではなく animation スケジュール時点で発火するため
// フェード開始に揃えるには使えず、setTimeout で delay と同じ時刻を張るのが正しい。
function StatRow({
  label,
  value,
  unit,
  order,
}: {
  label: string;
  value: string;
  unit?: string;
  order: number;
}) {
  const delay = STAT_FADE_INITIAL_DELAY_SEC + order * STAT_FADE_STAGGER_SEC;
  useEffect(() => {
    const id = setTimeout(() => playSound("chime"), delay * 1000);
    return () => clearTimeout(id);
  }, [delay]);
  return (
    <>
      <dt className="justify-self-start text-muted">{label}</dt>
      <m.dd
        className="relative justify-self-end font-mono font-medium tabular-nums text-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: STAT_FADE_DURATION_SEC, ease: "easeOut" }}
      >
        {value}
        {unit !== undefined && (
          <span className="absolute top-0 left-full ml-1 whitespace-nowrap">{unit}</span>
        )}
      </m.dd>
    </>
  );
}

// スコアの数字を 0 から target までカウントアップする。
// MotionValue を子として渡すと motion が自動購読して現在値を描画する。
// 親の <p> が font-mono + tabular-nums なので、桁数が増えても数字幅は変わらずレイアウトは安定。
function AnimatedScoreValue({ target }: { target: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    // onComplete は animate() が自然完了したフレームで呼ばれ、途中で stop() された場合は呼ばれない。
    // スコアが確定するフレームと sparkle の再生を同じタイミングに揃えるため、
    // 別 setTimeout ではなく animate() の onComplete で音を鳴らす。
    const controls = animate(count, target, {
      delay: SCORE_COUNTUP_DELAY_SEC,
      duration: SCORE_COUNTUP_DURATION_SEC,
      ease: SCORE_COUNTUP_EASE,
      onComplete: () => playSound("sparkle"),
    });
    return () => controls.stop();
  }, [count, target]);
  return <m.span>{rounded}</m.span>;
}

// 経過時間 ms を「小数第一位までの秒」に整形する。切り捨てで表示（切り上げると 9.98 → 10.0 の
// ように直感と外れるため）。
function formatSeconds(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const whole = Math.floor(tenths / 10);
  const decimal = tenths % 10;
  return `${whole}.${decimal}`;
}

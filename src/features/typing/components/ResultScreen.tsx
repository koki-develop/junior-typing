import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import type { GameResult } from "../../../domain/game/score.ts";
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

type Props = {
  result: GameResult;
  onRestart: () => void;
};

// 全問クリア後に表示する結果画面。
// スコアを大きく強調しつつ、小学生向けに漢字を控えたラベルで打鍵数・ミス数・時間を並べる。
// 「もういちど」ボタンでリスタート。キーボードでは Space でも再開できる（machine.ts の done で処理）。
export function ResultScreen({ result, onRestart }: Props) {
  return (
    <div className="grid place-items-center gap-10 text-center">
      <div className="grid place-items-center gap-2">
        <p className="text-lg tracking-[0.28em] text-muted">スコア</p>
        {/* aria-label は最終値の固定文字列。カウントアップ中の途中値を読み上げさせない。
            opacity 0 でスタートさせて「開始時に 0 が大きく表示される」印象を避け、
            カウントアップ開始と同時に一瞬でフェードインさせる。 */}
        <motion.p
          aria-label={`スコア ${result.score}`}
          className="font-mono text-[clamp(72px,10vw,120px)] font-medium leading-none tracking-tight tabular-nums text-accent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: SCORE_COUNTUP_DELAY_SEC,
            duration: SCORE_FADE_IN_DURATION_SEC,
            ease: "easeOut",
          }}
        >
          <AnimatedScoreValue target={result.score} />
        </motion.p>
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
      <motion.dd
        className="relative justify-self-end font-mono font-medium tabular-nums text-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: STAT_FADE_DURATION_SEC, ease: "easeOut" }}
      >
        {value}
        {unit !== undefined && (
          <span className="absolute top-0 left-full ml-1 whitespace-nowrap">{unit}</span>
        )}
      </motion.dd>
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
  return <motion.span>{rounded}</motion.span>;
}

// 経過時間 ms を「小数第一位までの秒」に整形する。切り捨てで表示（切り上げると 9.98 → 10.0 の
// ように直感と外れるため）。
function formatSeconds(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const whole = Math.floor(tenths / 10);
  const decimal = tenths % 10;
  return `${whole}.${decimal}`;
}

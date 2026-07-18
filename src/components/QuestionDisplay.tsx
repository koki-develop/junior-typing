import { RomajiText } from "./RomajiText.tsx";

type Props = {
  // ふりがな（漢字の上に表示するかな）。
  kana: string;
  // 表示する見出しテキスト（漢字混じり）。
  text: string;
  typed: string;
  next: string;
  rest: string;
  // クリア演出中は花丸を重ねる。
  cleared: boolean;
};

// 「ふりがな → 見出し → ローマ字入力」を一組で表示する問題ブロック。
export function QuestionDisplay({ kana, text, typed, next, rest, cleared }: Props) {
  return (
    <div className="grid place-items-center gap-3 text-center">
      {/* 広い letter-spacing の視覚的なセンタリング用に左に同量のパディングを寄せる */}
      <p className="pl-[0.28em] text-sm tracking-[0.28em] text-muted">{kana}</p>
      {/* 花丸を絶対配置で重ねるので relative を持たせる。花丸のサイズは em で解決したいので、
          文字サイズが決まっているこの <p> の中に置く必要がある。 */}
      <p
        className={
          "relative text-[clamp(56px,8vw,88px)] font-medium leading-none tracking-[0.04em] " +
          "transition-colors duration-200 " +
          (cleared ? "text-emerald-500" : "text-ink")
        }
      >
        {text}
        {cleared && <HanamaruStamp />}
      </p>
      <div className="mt-4">
        <RomajiText typed={typed} next={next} rest={rest} />
      </div>
    </div>
  );
}

// 見出しを囲む赤い花丸を、下を起点にぐるっと 1 周描く。
// - <circle> の path 始点は 3 時方向で固定なので、transform="rotate(90 50 50)" で 6 時方向にずらす。
//   これで stroke-dashoffset の線描アニメーションが下から時計回りに進む。
// - サイズは em 基準 (親 <p> のフォントサイズが基準)。文字数に依らず常に一定サイズになる。
function HanamaruStamp() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 h-[2.6em] w-[2.6em] -translate-x-1/2 -translate-y-1/2"
    >
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="#e53935"
        strokeWidth="3.5"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="100"
        transform="rotate(90 50 50)"
        className="animate-hanamaru-draw"
      />
    </svg>
  );
}

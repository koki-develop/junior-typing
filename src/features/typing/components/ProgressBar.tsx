import { CLEAR_DELAY_MS } from "../../../domain/game/machine.ts";

type Props = {
  total: number;
  // 現在挑戦中の問題のインデックス（0 始まり）。
  // idle / countdown のように「まだ 1 問目に入っていない」フェーズでは null を渡す。
  // このとき aria-current="step" を持つセグメントは無くなり、進捗はゼロとして扱う。
  currentIndex: number | null;
  // 現在の問題のクリア演出中（正解エフェクトが鳴っている CLEAR_DELAY_MS の間）に true。
  // true のときは現在セグメントが左→右へ塗り潰されるフィルアニメを描き、
  // 演出終了と同時に次のレンダーで done セグメントへ置き換わる。
  filling?: boolean;
};

// 出題数と同数のセグメントを横に並べた進捗バー。
// current セグメントは内部を空色のまま外周のグローだけで「ここに居る」を示し、
// クリア演出中は内部の accent を scaleX(0→1) で左から右へ塗り上げる。
export function ProgressBar({ total, currentIndex, filling = false }: Props) {
  const value = currentIndex === null ? 0 : Math.min(currentIndex, total);
  return (
    <div
      className="flex justify-center gap-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      aria-label="タイピング進捗"
    >
      {Array.from({ length: total }, (_, i) => (
        <ProgressSegment key={i} state={segmentState(i, currentIndex, filling)} />
      ))}
    </div>
  );
}

type SegmentState = "done" | "current" | "filling" | "remaining";

function segmentState(i: number, currentIndex: number | null, filling: boolean): SegmentState {
  if (currentIndex === null) return "remaining";
  if (i < currentIndex) return "done";
  if (i === currentIndex) return filling ? "filling" : "current";
  return "remaining";
}

// current / filling は「アクティブなセグメント」の見た目を共有する。
// halo を持たず、内部の色だけで「remaining（faint）→ current（accent/60）→ done（accent）」の
// 3 段階の階調を作る。中間色ソリッドが並ぶことで「進行中」が色の位置関係だけで伝わり、
// 本体色と halo 色が近くて境界が消える問題を根本から回避する。
// filling のときはこの器の中に不透明な accent の子要素を重ねて scaleX(0→1) を走らせる。
// 完了時点で本体色 = accent（=子要素）に揃い、そのまま次レンダーで done へ滑らかに接続する。
const ACTIVE_SHELL_CLASS = "h-1.5 w-12 rounded-full bg-accent/60";

function ProgressSegment({ state }: { state: SegmentState }) {
  if (state === "remaining") return <span className="h-1.5 w-12 rounded-full bg-faint" />;
  if (state === "done") return <span className="h-1.5 w-12 rounded-full bg-accent" />;
  if (state === "current") {
    return <span className={ACTIVE_SHELL_CLASS} aria-current="step" />;
  }
  // filling: 器は current と同じ見た目のまま、内側に accent の帯を左→右で伸ばす。
  // - overflow-hidden + rounded-full の親でクリップさせるので、子は角丸を持たない
  // - animation-duration は CLEAR_DELAY_MS と完全同期。両者が別々に動かないよう
  //   inline style で焼き込み、CSS 側の @theme デフォルト値は上書きされる
  return (
    <span className={`${ACTIVE_SHELL_CLASS} relative overflow-hidden`} aria-current="step">
      <span
        className="absolute inset-0 origin-left bg-accent animate-progress-fill"
        style={{ animationDuration: `${CLEAR_DELAY_MS}ms` }}
      />
    </span>
  );
}

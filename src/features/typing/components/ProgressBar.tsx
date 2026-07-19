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
// アクティブセグメントは色の階調（faint → accent/60 → accent）で位置付けを示し、
// さらに「上に浮く▼マーカー」と「pill のパルス」を重ねて生きている感を出す。
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

// remaining / done は装飾なしの単色 pill。1 つの span で表現する。
function StaticSegment({ tone }: { tone: "faint" | "accent" }) {
  const className =
    tone === "faint" ? "h-1.5 w-12 rounded-full bg-faint" : "h-1.5 w-12 rounded-full bg-accent";
  return <span className={className} />;
}

// current / filling は「アクティブなセグメント」の見た目を共有する。
// 色は remaining（faint）→ current（accent/60）→ done（accent）の 3 段階で階調を作り、
// halo に頼らず位置関係だけで進行度を伝える。その上で以下 2 つの装飾を重ねる:
//   1) pill の▼マーカー: 上にはみ出るので relative ラッパを 1 段挟んで overflow を許容
//   2) 常時パルス（opacity 1↔0.72）: 「生きている＝アクティブ」の合図
// filling 中はパルスを外し、代わりに内側で accent 子要素が scaleX(0→1) で塗り上げる。
// 完了時点で本体色 = accent（=子要素）に揃い、次レンダーで done へ滑らかに接続する。
function ActiveSegment({ filling }: { filling: boolean }) {
  return (
    // ラッパは pill と同じ h/w を持ち、内側は absolute inset-0 で pill を配置する。
    // pill 側に overflow-hidden を掛けても、マーカーはこのラッパ直下にあるので上へ抜けられる。
    <span className="relative h-1.5 w-12" aria-current="step">
      <span
        className={
          filling
            ? "absolute inset-0 overflow-hidden rounded-full bg-accent/60"
            : "absolute inset-0 rounded-full bg-accent/60 animate-progress-pulse"
        }
      >
        {filling && (
          // - overflow-hidden + rounded-full の親でクリップさせるので、子は角丸を持たない
          // - animation-duration は CLEAR_DELAY_MS と完全同期。両者が別々に動かないよう
          //   inline style で焼き込み、CSS 側の @theme デフォルト値は上書きされる
          <span
            className="absolute inset-0 origin-left bg-accent animate-progress-fill"
            style={{ animationDuration: `${CLEAR_DELAY_MS}ms` }}
          />
        )}
      </span>
      <ActiveMarker />
    </span>
  );
}

// pill のちょうど真上、3px 浮かせて置く▼マーカー。「ここに居る」を色や動きに頼らず形で示す。
// SVG にしておくと currentColor（fill-accent）で色を palette と結び付けられる。
function ActiveMarker() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 5"
      className="pointer-events-none absolute bottom-full left-1/2 h-1.25 w-2 -translate-x-1/2 -translate-y-0.75 fill-accent"
    >
      <polygon points="0,0 8,0 4,5" />
    </svg>
  );
}

function ProgressSegment({ state }: { state: SegmentState }) {
  if (state === "remaining") return <StaticSegment tone="faint" />;
  if (state === "done") return <StaticSegment tone="accent" />;
  return <ActiveSegment filling={state === "filling"} />;
}

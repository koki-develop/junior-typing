import { useLayoutEffect, useRef, useState } from "react";
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

// セグメント 1 個ぶんの幅（w-12 = 3rem = 48px、ルート 16px 前提）。
const SEGMENT_WIDTH = 48;
// セグメント間の隙間（gap-1.5 = 0.375rem = 6px）。
const SEGMENT_GAP = 6;

// 出題数と同数のセグメントを横に並べた進捗バー。
// アクティブセグメントは色の階調（faint → accent/60 → accent）で位置付けを示し、
// さらに「上に浮く▼マーカー」と「pill のパルス」を重ねて生きている感を出す。
//
// セグメントは 1 個 48px 固定（w-12）で組んであるため、total（questionCount）が多い出題
// セットや画面幅が狭い端末では合計幅（SEGMENT_WIDTH * total + SEGMENT_GAP * (total-1)）が
// 可搬幅を超えうる。TypingScreen の親 grid は place-items-center のため、素の div は
// 非ストレッチ配置になり自身の max-content 幅（= セグメント合計幅）でそのまま描画されて
// 列をはみ出す。Keyboard.tsx が同じ constraints（800px 固定幅のレイアウトが狭い画面を
// はみ出す）に対して使っている手法をここでも踏襲する: 外側ラッパーを w-full で列幅に
// 定幅バインドし、実測幅で収まらない分だけ内側の行を transform: scale で一様縮小する。
// 自然幅は DOM 実測（scrollWidth）ではなく上記定数から計算する ——
// row は overflow: visible のままなので、はみ出したセグメントがあっても scrollWidth は
// clientWidth と同値にしかならず、実測では正しい自然幅を拾えない
// （Keyboard.tsx も同じ理由で KEYBOARD_WIDTH を実測でなく定数で持っている）。
// ただし Keyboard と異なり overflow-hidden は掛けない ——ActiveMarker（▼）がセグメント
// 上端からはみ出す装飾を意図的に持つため、クリップするとマーカーが天井で欠けてしまう。
// scale は useLayoutEffect で初回ペイント前に確定するので、はみ出した状態が一瞬でも
// 見える心配は無い。
export function ProgressBar({ total, currentIndex, filling = false }: Props) {
  const value = currentIndex === null ? 0 : Math.min(currentIndex, total);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const natural = total * SEGMENT_WIDTH + Math.max(0, total - 1) * SEGMENT_GAP;
    if (natural === 0) return;
    const update = () => setScale(Math.min(1, wrapper.clientWidth / natural));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [total]);

  return (
    <div ref={wrapperRef} className="w-full">
      <div
        className="flex justify-center gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        aria-label="タイピング進捗"
        style={{ transform: `scale(${scale})` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <ProgressSegment key={i} state={segmentState(i, currentIndex, filling)} />
        ))}
      </div>
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
// shrink-0: 親の transform: scale による縮小と flex-shrink による潰れが二重に効かないよう、
// 常に w-12 の自然幅を保たせる（実際の縮小表示は親の scale だけが担う）。
function StaticSegment({ tone }: { tone: "faint" | "accent" }) {
  const className =
    tone === "faint"
      ? "h-1.5 w-12 shrink-0 rounded-full bg-faint"
      : "h-1.5 w-12 shrink-0 rounded-full bg-accent";
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
    // shrink-0 の理由は StaticSegment 側のコメントを参照。
    <span className="relative h-1.5 w-12 shrink-0" aria-current="step">
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

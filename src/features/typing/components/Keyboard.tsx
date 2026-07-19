import { useLayoutEffect, useRef, useState } from "react";

type Props = {
  // 次に押すキー（1 文字、大小問わず）。null なら強調なし。
  activeKey: string | null;
};

// MacBook JIS 配列を再現した鍵盤ビジュアル。次に打鍵すべきアルファベット、
// または idle 画面での Space キーだけ柿色で塗り、それ以外（数字・記号・修飾・矢印）は無地で並べる。
// esc, fn キーは仕様外なので描かない（ファンクション段自体を持たない）。
// 純粋な視覚ヒントで、操作可能ではない（aria-hidden）。
//
// 内部のキー配置は全て KEYBOARD_WIDTH=800px 前提の px 値で組んである（各キーの幅比率が
// 崩れると JIS 配列の見た目が壊れるため）。画面幅がそれより狭い場合に備え、実測幅に応じて
// transform: scale で縮小表示する。ラッパーの高さも scale 分だけ縮めないと、
// レイアウト上は元の高さのまま下に余白が残ってしまう。
export function Keyboard({ activeKey }: Props) {
  const active = activeKey?.toLowerCase() ?? null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / KEYBOARD_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="mx-auto w-full overflow-hidden"
      style={{
        maxWidth: `${KEYBOARD_WIDTH}px`,
        height: `${(KEYBOARD_HEIGHT + SHADOW_PAD) * scale}px`,
      }}
    >
      <div
        className="flex flex-col"
        style={{
          gap: `${GAP}px`,
          width: `${KEYBOARD_WIDTH}px`,
          height: `${KEYBOARD_HEIGHT}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        aria-hidden="true"
      >
        <KeyRow keys={ROW_NUMBERS} active={active} />
        {/* QWERTY 段と ASDF 段は Enter が L 字でまたぐので relative でまとめる。
            Enter を absolute で右上に重ね、clip-path で下段の左隅（Enter 下部より狭くなる領域）を落とす。 */}
        <div className="relative flex flex-col" style={{ gap: `${GAP}px` }}>
          <KeyRow keys={ROW_QWERTY} active={active} />
          <KeyRow keys={ROW_ASDF} active={active} />
          <EnterKey />
        </div>
        <KeyRow keys={ROW_ZXCV} active={active} />
        <div className="flex" style={{ gap: `${GAP}px` }}>
          {ROW_SPACE.map((k, i) => (
            <KeyCap key={`sp-${i}`} spec={k} active={active} />
          ))}
          <ArrowArea />
        </div>
      </div>
    </div>
  );
}

type KeySpec = {
  // 可視幅（px）。行内の合計 + ギャップが KEYBOARD_WIDTH と一致するよう決めてある。
  w: number;
  // アルファベットキーのみ letter を持ち、activeKey と一致すれば強調される。
  // 数字・記号・修飾キーは無地表示なので undefined。
  letter?: string;
  // アルファベット以外で強調対象になるキー（現状 Space のみ）。activeKey と一致すれば強調される。
  special?: "space";
};

const GAP = 8;
const ROW_H = 48;
const ALPHA_W = 48; // 標準キー（A〜Z、数字、Tab、[、;、: など）の幅。
const WIDER_W = 60; // 「少し横長」なキー（1、delete、Control、Command、英数、かな）の幅。
const LEFT_SHIFT_W = 92; // 左 Shift は上段 A キーの中央まで届く長さ。A の中央 = Control(60) + gap(8) + A(48/2) = 92。
const RIGHT_SHIFT_W = 84; // 行合計に合わせて算出。
const ENTER_TOP_W = 72; // QWERTY 段の残り幅から算出。
const ENTER_BOT_W = 60; // ASDF 段の残り幅から算出。ENTER_TOP_W より狭いので、L 字の出っ張りは上段側に生じる。
const SPACE_W = 192; // Space 行の残り幅から算出（他 8 キー + 矢印エリア + 8 個のギャップを 800px から引いた分）。
const ARROW_W = 48; // 各矢印セル 1 個の幅。上下半分（20px）× 3 列。
const ARROW_HALF_H = 20; // 半キー高。上下合計 + row-gap = ROW_H に収まるよう調整。
const ARROW_AREA_W = ARROW_W * 3 + GAP * 2;
const KEYBOARD_WIDTH = 800;
// 可視 5 段（数字 / QWERTY / ASDF / ZXCV / Space）× ROW_H + 段間ギャップ 4 個分。
const KEYBOARD_HEIGHT = ROW_H * 5 + GAP * 4;
// 強調時の box-shadow（0 0 0 5px）が最下段（Space）で欠けないよう、
// ラッパーの overflow-hidden の高さにだけ足しておく余白。他の 3 辺はギャップ（8px）内で収まる。
const SHADOW_PAD = 6;

// 数字段。1 と delete だけ「少し横長」で、他の 12 キーは標準幅。合計 2*60 + 12*48 + 13*8 = 800。
const ROW_NUMBERS: KeySpec[] = [
  { w: WIDER_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: WIDER_W },
];

// QWERTY 段。Tab と [ は他と同幅の標準キー。@ も同幅。Enter 上部は EnterKey で別描画。
const ROW_QWERTY: KeySpec[] = [
  { w: ALPHA_W },
  { w: ALPHA_W, letter: "q" },
  { w: ALPHA_W, letter: "w" },
  { w: ALPHA_W, letter: "e" },
  { w: ALPHA_W, letter: "r" },
  { w: ALPHA_W, letter: "t" },
  { w: ALPHA_W, letter: "y" },
  { w: ALPHA_W, letter: "u" },
  { w: ALPHA_W, letter: "i" },
  { w: ALPHA_W, letter: "o" },
  { w: ALPHA_W, letter: "p" },
  { w: ALPHA_W },
  { w: ALPHA_W },
];

// ASDF 段。Control だけ「少し横長」。; : ] は標準幅。Enter 下部は EnterKey で別描画。
const ROW_ASDF: KeySpec[] = [
  { w: WIDER_W },
  { w: ALPHA_W, letter: "a" },
  { w: ALPHA_W, letter: "s" },
  { w: ALPHA_W, letter: "d" },
  { w: ALPHA_W, letter: "f" },
  { w: ALPHA_W, letter: "g" },
  { w: ALPHA_W, letter: "h" },
  { w: ALPHA_W, letter: "j" },
  { w: ALPHA_W, letter: "k" },
  { w: ALPHA_W, letter: "l" },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
];

// ZXCV 段。左 Shift は上段 A の中央（x=92）まで、右 Shift は行合計に合わせて 84px。
const ROW_ZXCV: KeySpec[] = [
  { w: LEFT_SHIFT_W },
  { w: ALPHA_W, letter: "z" },
  { w: ALPHA_W, letter: "x" },
  { w: ALPHA_W, letter: "c" },
  { w: ALPHA_W, letter: "v" },
  { w: ALPHA_W, letter: "b" },
  { w: ALPHA_W, letter: "n" },
  { w: ALPHA_W, letter: "m" },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: RIGHT_SHIFT_W },
];

// Space 段。control option command 英数 space かな command option [矢印エリア]。
// command / 英数 / かな は「少し横長」＝ WIDER_W。control / option は標準幅。
const ROW_SPACE: KeySpec[] = [
  { w: ALPHA_W },
  { w: ALPHA_W },
  { w: WIDER_W },
  { w: WIDER_W },
  { w: SPACE_W, special: "space" },
  { w: WIDER_W },
  { w: WIDER_W },
  { w: ALPHA_W },
];

function KeyRow({ keys, active }: { keys: KeySpec[]; active: string | null }) {
  return (
    <div className="flex" style={{ gap: `${GAP}px` }}>
      {keys.map((k, i) => (
        <KeyCap key={i} spec={k} active={active} />
      ))}
    </div>
  );
}

function KeyCap({ spec, active }: { spec: KeySpec; active: string | null }) {
  const isActive =
    (spec.letter != null && active === spec.letter) ||
    (spec.special != null && active === spec.special);
  return (
    <div
      className={
        isActive
          ? "grid shrink-0 place-items-center rounded-lg bg-accent font-mono text-sm font-semibold text-canvas shadow-[0_0_0_5px_rgba(240,82,58,0.16)]"
          : "grid shrink-0 place-items-center rounded-lg bg-ink/5 font-mono text-sm font-semibold text-ink/60"
      }
      style={{ width: `${spec.w}px`, height: `${ROW_H}px` }}
    >
      {spec.letter?.toUpperCase() ?? ""}
    </div>
  );
}

// Enter キー（JIS の L 字）。QWERTY 段と ASDF 段にまたがる 1 つの要素。
// 幅は上段部（ENTER_TOP_W = 72px）に合わせて右端に配置し、
// clip-path で下段の左端（ENTER_TOP_W - ENTER_BOT_W = 12px 分）を切り落として
// 「上が広く・下が狭い」JIS の L 字を再現する。
// 段間ギャップ（8px）は狭い下段側で塗る（= 広い上段の下端を row 3 の底 y=48 で止める）。
// こうしないと上段の左下角がちょうど下段の ] キーの右上角に張り付いて衝突するので、
// 上段の下端をギャップの上まで戻して縦にも 8px の隙間を確保している。
// clip-path は path() を使って外周の凸角 5 つを他キーと同じ 8px（rounded-lg）で丸める。
// 内側の凹角（notch の右上）は物理キーでも直角なので、そのまま鋭角にしてある。
function EnterKey() {
  const W = ENTER_TOP_W;
  const notchDepth = ENTER_TOP_W - ENTER_BOT_W;
  const topFillH = ROW_H;
  const H = ROW_H * 2 + GAP;
  const R = 8; // rounded-lg (0.5rem) と同じ半径で他キーと揃える。
  // 時計回りに外周をなぞる SVG パス。凸角 (0,0)/(W,0)/(W,H)/(notchDepth,H)/(0,topFillH) を各 R で丸め、
  // 凹角 (notchDepth, topFillH) だけ直角のまま L → L で繋ぐ。
  const path = [
    `M ${R} 0`,
    `L ${W - R} 0`,
    `A ${R} ${R} 0 0 1 ${W} ${R}`,
    `L ${W} ${H - R}`,
    `A ${R} ${R} 0 0 1 ${W - R} ${H}`,
    `L ${notchDepth + R} ${H}`,
    `A ${R} ${R} 0 0 1 ${notchDepth} ${H - R}`,
    `L ${notchDepth} ${topFillH}`,
    `L ${R} ${topFillH}`,
    `A ${R} ${R} 0 0 1 0 ${topFillH - R}`,
    `L 0 ${R}`,
    `A ${R} ${R} 0 0 1 ${R} 0`,
    "Z",
  ].join(" ");
  return (
    <div
      className="absolute bg-ink/5"
      style={{
        right: 0,
        top: 0,
        width: `${W}px`,
        height: `${H}px`,
        clipPath: `path("${path}")`,
      }}
    />
  );
}

// 矢印エリア。← ↑ ↓ → の 4 つとも半キー高で、逆 T 字に並ぶ:
//   [空 ] [ ↑ ] [空 ]
//   [ ← ] [ ↓ ] [ → ]
// 上段の左右は本当に空セル（背景なし）で、下段に 3 つの矢印キーが並ぶ。
function ArrowArea() {
  return (
    <div
      className="grid"
      style={{
        gap: `${GAP}px`,
        gridTemplateColumns: `repeat(3, ${ARROW_W}px)`,
        gridTemplateRows: `${ARROW_HALF_H}px ${ARROW_HALF_H}px`,
        width: `${ARROW_AREA_W}px`,
        height: `${ROW_H}px`,
      }}
    >
      <div />
      <div className="rounded bg-ink/5" />
      <div />
      <div className="rounded bg-ink/5" />
      <div className="rounded bg-ink/5" />
      <div className="rounded bg-ink/5" />
    </div>
  );
}

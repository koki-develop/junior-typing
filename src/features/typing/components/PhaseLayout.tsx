import type { ReactNode } from "react";

type Props = {
  // ふりがな段。省略時は invisible プレースホルダで高さだけ確保する。
  top?: ReactNode;
  // 見出し段。フォントサイズ・太さ・行間・字間はここで固定する。
  // countdown の数字のように親より大きいフォントで描きたい場合は main 側の要素で
  // 自分の font-size を上書きすればよい（数値指定の font-size は継承されないので素直に上書きできる）。
  main: ReactNode;
  // ローマ字段。省略時は invisible プレースホルダで高さだけ確保する。
  // font-family / サイズ / 太さ / 字間はこの段（の器）だけが持つ。RomajiText 側は
  // 自前のタイポグラフィクラスを持たず、ここからの継承に一本化している。
  bottom?: ReactNode;
};

// Idle / Countdown / Question の中央 3 段（ふりがな / 見出し / ローマ字）が共有するレイアウト。
// ふりがな段・ローマ字段は invisible プレースホルダでコンテンツの有無に関わらず高さを確保し、
// 見出し段は min-h で高さの下限だけ揃える（問題文が折り返した分は箱ごと伸びる）ことで、
// フェーズ遷移中に進捗バーやキーボードヒントが不必要に跳ねないようにする。
export function PhaseLayout({ top, main, bottom }: Props) {
  return (
    <div className="grid place-items-center gap-3 text-center">
      {/* 広い letter-spacing の視覚的なセンタリング用に左に同量のパディングを寄せる */}
      <p
        className={
          "pl-[0.28em] text-lg tracking-[0.28em] text-muted" +
          (top === undefined ? " invisible" : "")
        }
        {...(top === undefined ? { "aria-hidden": true } : {})}
      >
        {top ?? <>&nbsp;</>}
      </p>
      {/* 見出しの高さの下限を固定した箱。min-h なので、狭い画面で問題文が2行に折り返しても
          箱が伸びて下のローマ字段を押し下げる（重ならない）。countdown の数字はこの箱の
          高さに影響しない絶対配置オーバーレイとして描くため、relative を持たせておく
          （leading-none + place-items-center で中央揃えを固定）。 */}
      <div className="relative grid min-h-15 place-items-center text-6xl font-medium leading-none tracking-wider md:min-h-18 md:text-7xl">
        {main}
      </div>
      <div
        className={
          "mt-4 font-mono text-2xl font-semibold tracking-wider md:text-3xl" +
          (bottom === undefined ? " invisible" : "")
        }
        {...(bottom === undefined ? { "aria-hidden": true } : {})}
      >
        {bottom ?? <>&nbsp;</>}
      </div>
    </div>
  );
}

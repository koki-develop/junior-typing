import { RomajiText } from "./RomajiText.tsx";

type Props = {
  // ふりがな（漢字の上に表示するかな）。
  kana: string;
  // 表示する見出しテキスト（漢字混じり）。
  text: string;
  typed: string;
  next: string;
  rest: string;
};

// 「ふりがな → 見出し → ローマ字入力」を一組で表示する問題ブロック。
export function QuestionDisplay({ kana, text, typed, next, rest }: Props) {
  return (
    <div className="grid place-items-center gap-3 text-center">
      {/* 広い letter-spacing の視覚的なセンタリング用に左に同量のパディングを寄せる */}
      <p className="pl-[0.28em] text-sm tracking-[0.28em] text-muted">{kana}</p>
      <p className="text-[clamp(56px,8vw,88px)] font-bold leading-none tracking-[0.04em]">{text}</p>
      <div className="mt-4">
        <RomajiText typed={typed} next={next} rest={rest} />
      </div>
    </div>
  );
}

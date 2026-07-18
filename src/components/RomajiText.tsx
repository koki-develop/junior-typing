type Props = {
  // 入力済みのローマ字。
  typed: string;
  // 次に打つ 1 文字。空文字なら描画しない。
  next: string;
  // next の後に続くローマ字。
  rest: string;
};

// タイピング進捗のローマ字表示。
// typed: 淡色 / next: 直下に柿色の下線 / rest: 標準色。
// 文字の太さは 3 状態すべてで揃え、下線と色の差だけで進捗を示す。
export function RomajiText({ typed, next, rest }: Props) {
  return (
    <p className="font-mono text-2xl font-semibold tracking-wider md:text-[28px]">
      <span className="text-faded">{typed}</span>
      {next !== "" && <NextChar char={next} />}
      <span className="text-ink">{rest}</span>
    </p>
  );
}

// 次に打つ 1 文字。周囲と同じ太さのまま、直下の柿色下線で指し示す。
function NextChar({ char }: { char: string }) {
  return (
    <span
      className={
        "relative text-ink " +
        "after:absolute after:-bottom-1.5 after:left-0 after:right-0 " +
        "after:h-[3px] after:rounded-sm after:bg-accent after:content-['']"
      }
    >
      {char}
    </span>
  );
}

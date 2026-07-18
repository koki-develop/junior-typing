type Props = {
  // 次に押すキー（1 文字、大文字小文字は問わない）。null なら強調なし。
  activeKey: string | null;
};

// QWERTY 配列で描く鍵盤ビジュアル。次に押すキーだけ柿色で塗り、
// 他は薄いグレーに沈める。純粋な視覚ヒントで、操作可能ではない（aria-hidden）。
export function Keyboard({ activeKey }: Props) {
  const active = activeKey?.toLowerCase() ?? null;
  return (
    <div className="grid gap-2" aria-hidden="true">
      {KEY_ROWS.map((row) => (
        <div key={row.id} className={`flex justify-center gap-2 ${row.offsetClass}`}>
          {row.keys.map((letter) => (
            <KeyCap key={letter} letter={letter} active={active === letter} />
          ))}
        </div>
      ))}
    </div>
  );
}

// QWERTY の 3 段。各段の左オフセットは Mac 配列に合わせる:
// - row1(QWERTY) を基準に、row2(ASDF) は約半キー右
// - row3(ZXCV) は row1 と同じ左端に揃える
const KEY_ROWS = [
  { id: "row1", offsetClass: "", keys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"] },
  { id: "row2", offsetClass: "pl-6", keys: ["a", "s", "d", "f", "g", "h", "j", "k", "l"] },
  { id: "row3", offsetClass: "", keys: ["z", "x", "c", "v", "b", "n", "m"] },
] as const;

function KeyCap({ letter, active }: { letter: string; active: boolean }) {
  const base = "grid h-12 w-12 place-items-center rounded-lg font-mono text-sm font-semibold";
  return (
    <div
      className={
        active
          ? `${base} bg-accent text-canvas shadow-[0_0_0_5px_rgba(240,82,58,0.16)]`
          : `${base} bg-ink/5 text-ink/60`
      }
    >
      {letter.toUpperCase()}
    </div>
  );
}

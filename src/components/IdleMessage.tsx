// 開始待ち画面。QuestionDisplay と同じ 3 段構造（ふりがな / 見出し / ローマ字）で組み、
// 縦寸法を揃えることで idle → countdown → playing の遷移中に下段の Keyboard が
// 上下に跳ねないようにする（1 段目は不可視のプレースホルダ）。
export function IdleMessage() {
  return (
    <div className="grid place-items-center gap-3 text-center">
      <p className="invisible text-lg tracking-[0.28em]" aria-hidden>
        &nbsp;
      </p>
      <p className="text-[clamp(56px,8vw,88px)] font-medium leading-none tracking-[0.04em] text-ink">
        スタート
      </p>
      <p className="mt-4 font-mono text-2xl font-semibold tracking-wider text-muted md:text-[28px]">
        スペースキーで開始
      </p>
    </div>
  );
}

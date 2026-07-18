import type { CountdownValue } from "../lib/useTypingGame.ts";

type Props = {
  count: CountdownValue;
};

// 3 → 2 → 1 の秒読み表示。
// - QuestionDisplay と同じ 3 段構造で組み、上下段は不可視プレースホルダで高さを揃える
//   （idle / playing との遷移で Keyboard が跳ねないため）。
// - 数字は QuestionDisplay の見出しより一段大きくして意識を中央に集める。
//   親の高さは leading-none で見出しと同じに固定し、視覚的にはみ出す分は許容する。
// - key={count} で毎段リマウントして animate-countdown-pop を再発火する。
export function CountdownMessage({ count }: Props) {
  return (
    <div
      className="grid place-items-center gap-3 text-center"
      // 秒読みの数字変化を支援技術に読み上げさせる。aria-atomic で毎回全文を発話し、
      // assertive で他の読み上げを割り込ませて「3, 2, 1」を確実に届ける。
      aria-live="assertive"
      aria-atomic="true"
    >
      <p className="invisible text-lg tracking-[0.28em]" aria-hidden>
        &nbsp;
      </p>
      <div className="grid h-[clamp(56px,8vw,88px)] place-items-center leading-none">
        <span
          key={count}
          className="animate-countdown-pop text-[clamp(88px,12vw,144px)] font-medium leading-none tabular-nums text-accent"
        >
          {count}
        </span>
      </div>
      <p
        className="invisible mt-4 font-mono text-2xl font-semibold tracking-wider md:text-[28px]"
        aria-hidden
      >
        &nbsp;
      </p>
    </div>
  );
}

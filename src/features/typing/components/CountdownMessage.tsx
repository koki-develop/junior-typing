import type { CountdownValue } from "../../../domain/game/machine.ts";
import { PhaseLayout } from "./PhaseLayout.tsx";

type Props = {
  count: CountdownValue;
};

// 3 → 2 → 1 の秒読み表示。PhaseLayout を共有し、上下段は invisible プレースホルダで
// 高さを揃える（idle / playing との遷移で Keyboard が跳ねないため）。
// 数字は見出しより一段大きくして意識を中央に集める。見出し段は min-h で高さの下限だけを
// 決めているため、数字は absolute 配置で重ねて描画し、段の高さ（延いては idle / countdown /
// playing で段の高さが揃うという不変条件）に影響を与えないようにする。
// 読み上げは TypingScreen 側の常時マウントの live 領域が担うため、ここでは
// 二重に読み上げさせないよう aria-hidden にする。
export function CountdownMessage({ count }: Props) {
  return (
    <PhaseLayout
      main={
        // 数字を absolute にすると見出し段は通常フローのコンテンツを持たなくなり幅が 0 に潰れる
        // （高さは min-h が下限を保証するが、幅は保証しない）。left-1/2 + -translate-x-1/2 は
        // 自分自身の幅を基準に中央へ寄せる指定なので、親の幅が 0 でも正しく中央に描画できる
        // （QuestionDisplay の MaruStamp と同じテクニック）。
        // key={count} で毎段リマウントして animate-countdown-pop を再発火する。
        // tracking-normal で PhaseLayout の見出し用字間（0.04em）の継承を打ち消す。
        <span
          key={count}
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-countdown-pop text-[clamp(88px,12vw,144px)] tabular-nums tracking-normal text-accent"
        >
          {count}
        </span>
      }
    />
  );
}

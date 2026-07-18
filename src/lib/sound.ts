// cuelume の play() は React の状態やライフサイクルに依存せず、
// SSR や未対応ブラウザでは自動的に no-op になる。呼び出し側は
// 存在チェックや effect 経由での呼び出しを気にせず、任意のタイミング
// （reducer 外の副作用、イベントハンドラなど）から直接呼べる。
// そのため hook ではなく、依存先を隠すだけの薄い re-export にしている。
import { play } from "cuelume";
import type { SoundName } from "cuelume";

export type { SoundName };

export function playSound(name?: SoundName): void {
  play(name);
}

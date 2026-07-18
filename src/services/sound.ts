// cuelume の play() は React の状態やライフサイクルに依存せず、
// SSR や未対応ブラウザでは自動的に no-op になる。呼び出し側は
// 存在チェックや effect 経由での呼び出しを気にせず、任意のタイミング
// （イベントハンドラ、effect runner など）から直接呼べる。
// そのため hook ではなく、cuelume への依存を隠すだけの薄いアダプタにしている。
import { play } from "cuelume";
import type { SoundName } from "cuelume";
import type { GameSound } from "../domain/game/effects.ts";

// GameSound の各値が cuelume の SoundName としても有効であることを型で保証するマップ。
// Record<GameSound, SoundName> なので GameSound に新しい音を足すとこの定義がコンパイルエラーになり、
// マッピングの追記漏れを防げる。
const SOUND_NAMES = {
  bloom: "bloom",
  ready: "ready",
  page: "page",
  error: "error",
  success: "success",
} satisfies Record<GameSound, SoundName>;

export function playSound(sound: GameSound): void {
  play(SOUND_NAMES[sound]);
}

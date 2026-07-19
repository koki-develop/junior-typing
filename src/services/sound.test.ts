import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cuelume", () => ({ play: vi.fn(), bind: vi.fn() }));

import { bind, play } from "cuelume";
import type { GameSound } from "../domain/game/effects.ts";
import { bindInteractionSounds, playSound } from "./sound.ts";

// GameSound の全パターンを it.each で網羅する。新しい音を GameSound に足しても
// ここに追記しない限り検出されない（satisfies によるコンパイルエラーとは独立に、
// 実行時のマッピングが正しいことをテストで保証する）ため、GameSound を拡張したら
// この配列も更新すること。
const GAME_SOUNDS: readonly GameSound[] = ["bloom", "ready", "page", "error", "success"];

beforeEach(() => {
  vi.mocked(play).mockClear();
  vi.mocked(bind).mockClear();
});

describe("playSound", () => {
  it.each(GAME_SOUNDS)(
    "%s を渡すと cuelume の play に同名の SoundName を渡して呼び出す",
    (sound) => {
      playSound(sound);

      expect(play).toHaveBeenCalledTimes(1);
      expect(play).toHaveBeenCalledWith(sound);
    },
  );
});

describe("bindInteractionSounds", () => {
  it("cuelume の bind を呼び出す", () => {
    bindInteractionSounds();

    expect(bind).toHaveBeenCalledTimes(1);
  });
});

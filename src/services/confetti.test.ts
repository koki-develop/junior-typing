import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import confetti from "canvas-confetti";
import { fireConfetti } from "./confetti.ts";

beforeEach(() => {
  vi.mocked(confetti).mockClear();
});

describe("fireConfetti", () => {
  it("canvas-confetti を reduced-motion 対応済みのオプションで 1 回だけ呼び出す", () => {
    fireConfetti();

    expect(confetti).toHaveBeenCalledTimes(1);
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ disableForReducedMotion: true }),
    );
  });
});

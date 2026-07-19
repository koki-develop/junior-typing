import { describe, expect, it } from "vitest";
import { computeResult } from "./score.ts";

const T0 = 1_700_000_000_000;

// 期待値は「score.ts の定数と同じ式」ではなくリテラルで固定する。
// 定数（CORRECT_POINTS=10 / WRONG_PENALTY=5 / TIME_PENALTY_PER_SEC=1）を誤って変更した場合に、
// 期待値の再計算に流されずテストが落ちるようにするため。
describe("computeResult", () => {
  it("正解キーは +10、ミスは -5、経過秒（切り捨て）は -1 でスコアを算出する", () => {
    const result = computeResult(
      { correctKeys: 10, wrongKeys: 2, startedAt: T0 },
      T0 + 12_600, // 12.6 秒 → floor で 12 秒
    );
    // 10*10 - 2*5 - 12*1 = 78
    expect(result).toEqual({
      correctKeys: 10,
      wrongKeys: 2,
      totalKeys: 12,
      elapsedMs: 12_600,
      score: 78,
    });
  });

  it("スコアが負になる場合は 0 でクランプする", () => {
    // 0*10 - 10*5 - 60*1 = -110 → clamp 0
    const result = computeResult({ correctKeys: 0, wrongKeys: 10, startedAt: T0 }, T0 + 60_000);
    expect(result.score).toBe(0);
  });

  it("経過時間が 1 秒未満なら時間ペナルティは 0（floor されるため）", () => {
    // 5*10 - 0*5 - 0*1 = 50
    const result = computeResult({ correctKeys: 5, wrongKeys: 0, startedAt: T0 }, T0 + 999);
    expect(result.score).toBe(50);
    expect(result.elapsedMs).toBe(999);
  });

  it("endedAt < startedAt でも elapsedMs を負値にせず 0 にクランプする（表示の安全弁）", () => {
    // elapsedMs は 0 にクランプされるので時間ペナルティ 0 → 3*10 = 30
    const result = computeResult({ correctKeys: 3, wrongKeys: 0, startedAt: T0 + 100 }, T0);
    expect(result.elapsedMs).toBe(0);
    expect(result.score).toBe(30);
  });

  it("totalKeys は correct + wrong の合算", () => {
    const result = computeResult({ correctKeys: 7, wrongKeys: 4, startedAt: T0 }, T0);
    expect(result.totalKeys).toBe(11);
  });
});

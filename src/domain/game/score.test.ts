import { describe, expect, it } from "vitest";
import { computeResult, isPerfectScore } from "./score.ts";

const T0 = 1_700_000_000_000;

// 期待値は「score.ts の定数と同じ式」ではなくリテラルで固定する。
// 定数（ACCURACY_MAX=700 / SPEED_MAX=300 / TARGET_KEYS_PER_SEC=2）を誤って
// 変更した場合に、期待値の再計算に流されずテストが落ちるようにするため。
describe("computeResult", () => {
  it("ミスなし・目標レート（2 キー/秒）以上のプレイは満点 1000 になる", () => {
    // 5 キーを 0.999 秒で打鍵 → actualKps ≈ 5.005 keys/sec ≥ 2 で速度満点、
    // ミスなしで精度満点 → 700 + 300 = 1000
    const result = computeResult(
      { correctKeys: 5, wrongKeys: 0, startedAt: T0, clearedMs: 0 },
      T0 + 999,
    );
    expect(result).toEqual({
      correctKeys: 5,
      wrongKeys: 0,
      totalKeys: 5,
      elapsedMs: 999,
      score: 1000,
    });
  });

  it("ミスなし・目標レートの半分（1 キー/秒）なら 700 + 150 = 850", () => {
    // 10 キーを 10 秒で打鍵 → activeMs = 10000 → actualKps = 1
    // speedFrac = 0.5 → speed = 150
    const result = computeResult(
      { correctKeys: 10, wrongKeys: 0, startedAt: T0, clearedMs: 0 },
      T0 + 10_000,
    );
    expect(result.score).toBe(850);
  });

  it("精度・速度ともに部分的なプレイはそれぞれの比率で加算される", () => {
    // correctKeys=10, wrongKeys=2, elapsedMs=12600, clearedMs=0
    // accuracy = 700 * 10/12 = 583.333...
    // activeMs = 12600, actualKps = 10*1000 / 12600 ≈ 0.79365 keys/sec
    // speedFrac = 0.79365 / 2 = 0.39683
    // speed = 300 * 0.39683 ≈ 119.048
    // score = round(583.333 + 119.048) = round(702.381) = 702
    const result = computeResult(
      { correctKeys: 10, wrongKeys: 2, startedAt: T0, clearedMs: 0 },
      T0 + 12_600,
    );
    expect(result).toEqual({
      correctKeys: 10,
      wrongKeys: 2,
      totalKeys: 12,
      elapsedMs: 12_600,
      score: 702,
    });
  });

  it("速度は clearedMs を差し引いた activeMs で評価される（入力不可時間を除外）", () => {
    // correctKeys=10, wrongKeys=0, elapsedMs=13600, clearedMs=3600
    // → activeMs = 10000, actualKps = 1 → speedFrac=0.5 → speed=150
    // accuracy = 700
    // 期待: 850。clearedMs を無視して elapsedMs=13600 で計算すると
    // actualKps ≈ 0.735 → speedFrac ≈ 0.368 → speed ≈ 110 → 810 に落ちる。
    // 850 が返れば clearedMs が正しく差し引かれた証拠になる。
    const result = computeResult(
      { correctKeys: 10, wrongKeys: 0, startedAt: T0, clearedMs: 3600 },
      T0 + 13_600,
    );
    expect(result.score).toBe(850);
  });

  it("正解 0（全ミス）は精度・速度ともに 0 で score=0", () => {
    // accuracy = 0（correctKeys=0）
    // speed = 0（correctKeys=0 なので actualKps=0）
    const result = computeResult(
      { correctKeys: 0, wrongKeys: 10, startedAt: T0, clearedMs: 0 },
      T0 + 60_000,
    );
    expect(result.score).toBe(0);
  });

  it("endedAt < startedAt でも elapsedMs を負値にせず 0 にクランプし、速度は満点扱いになる", () => {
    // elapsedMs は 0 にクランプ。activeMs=0 の分岐で speedFrac=1（速度満点）。
    // 精度は 700 * 3/3 = 700 → score = 700 + 300 = 1000
    const result = computeResult(
      { correctKeys: 3, wrongKeys: 0, startedAt: T0 + 100, clearedMs: 0 },
      T0,
    );
    expect(result.elapsedMs).toBe(0);
    expect(result.score).toBe(1000);
  });

  it("clearedMs > elapsedMs の数値誤差ケースでも activeMs は 0 にクランプされる", () => {
    // 通常発生しない不変違反だが、防御として activeMs=0 → 速度満点扱いを検証する。
    // accuracy = 700 * 3/3 = 700, speed = 300 → 1000
    const result = computeResult(
      { correctKeys: 3, wrongKeys: 0, startedAt: T0, clearedMs: 5000 },
      T0 + 1000,
    );
    expect(result.score).toBe(1000);
  });

  it("打鍵が 1 つも無ければ score は 0（0/0 の端値ガード）", () => {
    // done 到達なら correctKeys >= 1 のはずだが、境界を守る。
    const result = computeResult(
      { correctKeys: 0, wrongKeys: 0, startedAt: T0, clearedMs: 0 },
      T0 + 5_000,
    );
    expect(result.score).toBe(0);
  });

  it("totalKeys は correct + wrong の合算", () => {
    const result = computeResult({ correctKeys: 7, wrongKeys: 4, startedAt: T0, clearedMs: 0 }, T0);
    expect(result.totalKeys).toBe(11);
  });
});

describe("isPerfectScore", () => {
  it("満点（1000）は true", () => {
    expect(isPerfectScore(1000)).toBe(true);
  });

  it("満点未満は false", () => {
    expect(isPerfectScore(999)).toBe(false);
    expect(isPerfectScore(500)).toBe(false);
    expect(isPerfectScore(0)).toBe(false);
  });

  it("満点を超える値は false（範囲外は満点扱いにしない）", () => {
    // 通常の経路では起きないが、判定関数の意味を守るため。
    expect(isPerfectScore(1001)).toBe(false);
  });
});

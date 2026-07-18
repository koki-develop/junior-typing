import { describe, expect, it } from "vitest";
import { buildPatterns } from "./patterns.ts";

describe("buildPatterns", () => {
  it("かなをモーラ単位に分割する", () => {
    expect(buildPatterns("ありがとう").map((p) => p.kana)).toEqual(["あ", "り", "が", "と", "う"]);
  });

  it("拗音は2文字で1モーラとして分割する", () => {
    expect(buildPatterns("おちゃ").map((p) => p.kana)).toEqual(["お", "ちゃ"]);
    expect(buildPatterns("きょう").map((p) => p.kana)).toEqual(["きょ", "う"]);
  });

  it("拗音でない並びは1文字ずつ分割する", () => {
    expect(buildPatterns("きよう").map((p) => p.kana)).toEqual(["き", "よ", "う"]);
  });

  it("複数の綴りを候補として持つ", () => {
    expect(buildPatterns("し")[0].candidates).toEqual(["si", "shi", "ci"]);
    expect(buildPatterns("じゃ")[0].candidates).toEqual(["zya", "ja", "jya"]);
  });

  it("長音符は - で入力する", () => {
    expect(buildPatterns("ー")[0].candidates).toEqual(["-"]);
  });

  it("小書き文字を単独で入力できる", () => {
    expect(buildPatterns("ゃ")[0].candidates).toEqual(["lya", "xya"]);
  });

  it("未対応の文字は例外を投げる", () => {
    expect(() => buildPatterns("漢")).toThrow("未対応のかな文字です");
    expect(() => buildPatterns("ア")).toThrow("未対応のかな文字です");
  });

  it("空文字列は空のパターンを返す", () => {
    expect(buildPatterns("")).toEqual([]);
  });

  describe("「ん」の候補", () => {
    it("次が母音・な行・や行なら単独 n を許容しない", () => {
      expect(buildPatterns("んい")[0].candidates).toEqual(["nn", "xn"]);
      expect(buildPatterns("んに")[0].candidates).toEqual(["nn", "xn"]);
      expect(buildPatterns("んや")[0].candidates).toEqual(["nn", "xn"]);
    });

    it("末尾なら単独 n を許容しない", () => {
      expect(buildPatterns("ほん")[1].candidates).toEqual(["nn", "xn"]);
    });

    it("次が子音（母音・な行・や行以外）なら単独 n を許容する", () => {
      expect(buildPatterns("んご")[0].candidates).toEqual(["n", "nn", "xn"]);
      expect(buildPatterns("んか")[0].candidates).toEqual(["n", "nn", "xn"]);
    });
  });

  describe("「っ」の候補", () => {
    it("次のモーラの各候補の先頭子音と ltu/xtu/ltsu を候補にする", () => {
      // こ の候補は ko/co なので k と c の両方を許容する
      expect(buildPatterns("っこ")[0].candidates).toEqual(["k", "c", "ltu", "xtu", "ltsu"]);
      expect(buildPatterns("った")[0].candidates).toEqual(["t", "ltu", "xtu", "ltsu"]);
    });

    it("末尾なら ltu/xtu/ltsu のみ許容する", () => {
      expect(buildPatterns("っ")[0].candidates).toEqual(["ltu", "xtu", "ltsu"]);
    });

    it("次のモーラの候補が母音始まりの場合は子音重ねを候補にしない", () => {
      expect(buildPatterns("っあ")[0].candidates).toEqual(["ltu", "xtu", "ltsu"]);
    });

    it("次のモーラの複数候補が同じ先頭子音を持つ場合は重複させない", () => {
      // し の候補は si/shi/ci。si と shi はどちらも先頭が s なので、
      // s を2回ではなく1回だけ候補に含める（s, c の順）
      expect(buildPatterns("っし")[0].candidates).toEqual(["s", "c", "ltu", "xtu", "ltsu"]);
    });
  });

  describe("「ん」と「っ」が同じ文字列に混在する場合", () => {
    it("右から左への解決が「っ」を挟んでも連鎖する", () => {
      // 「んっと」: と → っ（次が と なので t を候補に）→ ん（次の「っ」候補が
      // t/ltu/xtu/ltsu のいずれも母音・な行・や行始まりではないため単独 n を許容）
      // という右から左の依存が「っ」を1段挟んでも正しく解決されることを確認する
      const patterns = buildPatterns("んっと");
      expect(patterns.map((p) => p.kana)).toEqual(["ん", "っ", "と"]);
      expect(patterns[2].candidates).toEqual(["to"]);
      expect(patterns[1].candidates).toEqual(["t", "ltu", "xtu", "ltsu"]);
      expect(patterns[0].candidates).toEqual(["n", "nn", "xn"]);
    });
  });
});

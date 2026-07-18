import { describe, expect, it } from "vitest";
import { buildPatterns, createTypingState, isFinished, romajiDisplay, typeKey } from "./romaji";
import type { TypingState } from "./romaji";

// キー列を順に入力し、最終状態と拒否されたキーを返す
function typeSequence(kana: string, keys: string): { state: TypingState; rejected: string[] } {
  let state = createTypingState(kana);
  const rejected: string[] = [];
  for (const key of keys) {
    const result = typeKey(state, key);
    if (!result.correct) rejected.push(key);
    state = result.state;
  }
  return { state, rejected };
}

// キー列がすべて受理され、かつ入力が完了することを検証する
function expectCompletes(kana: string, keys: string) {
  const { state, rejected } = typeSequence(kana, keys);
  expect(rejected).toEqual([]);
  expect(isFinished(state)).toBe(true);
}

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
  });
});

describe("typeKey", () => {
  describe("基本的な入力", () => {
    it("ありがとう", () => {
      expectCompletes("ありがとう", "arigatou");
    });

    it("モーラごとに別表記で入力できる", () => {
      expectCompletes("し", "si");
      expectCompletes("し", "shi");
      expectCompletes("し", "ci");
      expectCompletes("つ", "tu");
      expectCompletes("つ", "tsu");
      expectCompletes("ふ", "fu");
      expectCompletes("ふ", "hu");
      expectCompletes("じ", "zi");
      expectCompletes("じ", "ji");
    });

    it("拗音を別表記で入力できる", () => {
      expectCompletes("おちゃをのむ", "otyawonomu");
      expectCompletes("おちゃをのむ", "ochawonomu");
      expectCompletes("おちゃをのむ", "ocyawonomu");
      expectCompletes("じゃ", "ja");
      expectCompletes("じゃ", "zya");
      expectCompletes("じゃ", "jya");
    });

    it("間違ったキーは拒否し、状態を変えない", () => {
      const { state } = typeSequence("ありがとう", "a");
      const result = typeKey(state, "x");
      expect(result.correct).toBe(false);
      expect(result.state).toBe(state);
    });

    it("間違ったキーの後も正しいキーで続行できる", () => {
      const { state, rejected } = typeSequence("ありがとう", "axrigatou");
      expect(rejected).toEqual(["x"]);
      expect(isFinished(state)).toBe(true);
    });

    it("入力完了後のキーはすべて拒否する", () => {
      const { state } = typeSequence("あ", "a");
      expect(isFinished(state)).toBe(true);
      const result = typeKey(state, "a");
      expect(result.correct).toBe(false);
      expect(result.state).toBe(state);
    });

    it("空文字列は最初から完了扱いになる", () => {
      expect(isFinished(createTypingState(""))).toBe(true);
    });
  });

  describe("「ん」の入力", () => {
    it("次が子音なら単独 n で入力できる", () => {
      expectCompletes("にほんご", "nihongo");
      expectCompletes("にほんご", "nihonngo");
      expectCompletes("にほんご", "nihoxngo");
    });

    it("次がな行なら nn が必要", () => {
      expectCompletes("こんにちは", "konnnitiha");
      expectCompletes("こんにちは", "konnnichiha");
      expectCompletes("こんにちは", "koxnnitiha");
    });

    it("次がな行のとき単独 n では次のモーラに進めない", () => {
      // 「ん」が nn 待ちのままになるため、後続のキーはすべて拒否される
      const { state, rejected } = typeSequence("こんにちは", "konitiha");
      expect(rejected).toEqual(["i", "t", "i", "h", "a"]);
      expect(isFinished(state)).toBe(false);
    });

    it("次がや行なら nn が必要", () => {
      expectCompletes("こんや", "konnya");
      const { rejected } = typeSequence("こんや", "konya");
      expect(rejected).toContain("y");
    });

    it("次が母音なら nn が必要", () => {
      expectCompletes("げんいん", "genninn");
      const { rejected } = typeSequence("げんいん", "genin");
      expect(rejected).toContain("i");
    });

    it("末尾の「ん」は nn が必要", () => {
      expectCompletes("ほん", "honn");
      const { state, rejected } = typeSequence("ほん", "hon");
      expect(rejected).toEqual([]);
      expect(isFinished(state)).toBe(false);
    });

    it("単独 n の確定保留は次のモーラのキーで解決される", () => {
      // "nihon" の時点では「ん」は n/nn どちらか未確定で、
      // "g" が来た時点で「ん」を n で確定して「ご」の入力に移る
      const { state } = typeSequence("にほんご", "nihon");
      expect(isFinished(state)).toBe(false);
      const result = typeKey(state, "g");
      expect(result.correct).toBe(true);
      expect(result.state.typed).toBe("nihon");
      expect(result.state.buffer).toBe("g");
    });
  });

  describe("「っ」の入力", () => {
    it("次のモーラの子音を重ねて入力できる", () => {
      expectCompletes("がっこうへいく", "gakkouheiku");
      expectCompletes("ざっし", "zassi");
    });

    it("次のモーラを別表記にしても子音重ねが機能する", () => {
      // っし を "s" + "shi" で入力する
      expectCompletes("ざっし", "zasshi");
    });

    it("ltu/xtu/ltsu で単独入力できる", () => {
      expectCompletes("がっこうへいく", "galtukouheiku");
      expectCompletes("がっこうへいく", "gaxtukouheiku");
      expectCompletes("がっこうへいく", "galtsukouheiku");
    });

    it("次のモーラに存在しない子音は拒否する", () => {
      const { rejected } = typeSequence("がっこう", "gas");
      expect(rejected).toEqual(["s"]);
    });
  });
});

describe("romajiDisplay", () => {
  it("初期状態では全体が未入力", () => {
    const display = romajiDisplay(createTypingState("こんにちは"));
    expect(display.typed).toBe("");
    expect(display.remaining).toBe("konnnitiha");
  });

  it("「っ」は次のモーラの子音重ねを推奨表示にする", () => {
    const display = romajiDisplay(createTypingState("がっこう"));
    expect(display.remaining).toBe("gakkou");
  });

  it("入力済み部分と残り部分を分けて返す", () => {
    const { state } = typeSequence("こんにちは", "kon");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("kon");
    expect(display.remaining).toBe("nnitiha");
  });

  it("入力途中のモーラはバッファに一致する候補を残りに表示する", () => {
    // 「し」の推奨は si だが、"sh" まで打ったら shi の残り "i" を表示する
    const { state } = typeSequence("し", "sh");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("sh");
    expect(display.remaining).toBe("i");
  });

  it("「ん」の確定保留中は残りの表示に n を重複させない", () => {
    const { state } = typeSequence("にほんご", "nihon");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("nihon");
    expect(display.remaining).toBe("go");
  });

  it("入力完了後は残りが空になる", () => {
    const { state } = typeSequence("ありがとう", "arigatou");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("arigatou");
    expect(display.remaining).toBe("");
  });
});

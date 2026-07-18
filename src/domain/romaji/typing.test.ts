import { describe, expect, it } from "vitest";
import { createTypingState, isFinished, romajiDisplay, typeKey } from "./typing.ts";
import type { TypingState } from "./typing.ts";

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

    it("末尾の「ん」で無効キーを送っても壊れず、その後 n は保留のまま受理される", () => {
      // 末尾の「ん」は nn/xn のみが候補（n 単独は不可）。
      // まず候補にない z を送って拒否されることを確認したうえで、
      // n を送ると（nn の前半として）受理はされるが末尾なので即確定はしない。
      const state = createTypingState("ん");
      const rejected = typeKey(state, "z");
      expect(rejected.correct).toBe(false);
      expect(rejected.state).toBe(state);

      const accepted = typeKey(state, "n");
      expect(accepted.correct).toBe(true);
      expect(accepted.state.buffer).toBe("n");
      expect(isFinished(accepted.state)).toBe(false);
    });

    it("単独 n 確定保留中に次モーラへの継続もできないキーを送ると、状態を変えずに拒否する", () => {
      // 「んご」で n まで打った直後は「ん」が n で確定するか nn まで伸びるか未確定。
      // ここで g にも n の伸長にも一致しない z を送ると、
      // 「ん」を n で確定→「ご」に z を retry、のいずれも一致せず最終的に拒否される
      // （typeKey 内の commit-then-retry 分岐が「retry も失敗する」ケースを通る）。
      const { state } = typeSequence("んご", "n");
      const result = typeKey(state, "z");
      expect(result.correct).toBe(false);
      expect(result.state).toBe(state);
    });

    it("末尾モーラを越えて retry が呼ばれても advance はクラッシュせず拒否を返す", () => {
      // このケースは実際のタイピング経路では発生しない：
      // 最後のモーラのバッファが候補と完全一致した状態で足止めされる、という状況は
      // 通常なら advance が即座に確定させてしまうため起こらない
      // （「ご」は候補が go の1つだけで、長い候補が残らないので確定を待たせられない）。
      // advance が「確定済みモーラの次」を安全に処理できることを守る防御的分岐なので、
      // TypingState を手動構築してその契約だけを検証する。
      const patterns = createTypingState("んご").patterns;
      const stuckAtLastMora: TypingState = {
        patterns,
        unitIndex: 1, // 最後のモーラ「ご」を指している
        buffer: "go", // 唯一の候補と完全一致（本来なら即確定しているはずの状態）
        typed: "n",
      };
      const result = typeKey(stuckAtLastMora, "x");
      expect(result.correct).toBe(false);
      expect(result.state).toBe(stuckAtLastMora);
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

  it("バッファがどの候補とも前方一致しない不整合な状態でも、先頭候補にフォールバックして表示する", () => {
    // typeKey が返す TypingState では buffer は常にいずれかの候補の前方一致になるため、
    // このケースは通常のタイピングフローでは発生しない。
    // それでも romajiDisplay は表示専用の射影として「壊れずに何かしら妥当な残りを返す」
    // 契約を持たせてあるので、その契約自体を手動構築した TypingState で検証する。
    const patterns = createTypingState("し").patterns; // 候補: si / shi / ci
    const inconsistent: TypingState = { patterns, unitIndex: 0, buffer: "z", typed: "" };
    const display = romajiDisplay(inconsistent);
    // z はどの候補にも前方一致しないため、先頭候補 si にフォールバックし、
    // 残りは "z" を打ったあとの続きではなく si の buffer 分（1文字）を除いた "i" になる
    expect(display.remaining).toBe("i");
  });
});

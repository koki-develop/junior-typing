import { describe, expect, it } from "vitest";
import {
  activeKanaIndex,
  createTypingState,
  isFinished,
  romajiDisplay,
  typeKey,
} from "./typing.ts";
import type { TypingState } from "./typing.ts";

// キー列を順に入力し、最終状態と拒否されたキーを返す。kanas は複数の読み方を渡せるが、
// 単一読みのテストは kanas: [kana] の 1 要素で使う。
function typeSequence(kanas: string[], keys: string): { state: TypingState; rejected: string[] } {
  let state = createTypingState(kanas);
  const rejected: string[] = [];
  for (const key of keys) {
    const result = typeKey(state, key);
    if (!result.correct) rejected.push(key);
    state = result.state;
  }
  return { state, rejected };
}

// 単一読み用の薄いラッパ。ほとんどの既存テストは単一読みでよいので、
// 呼び出し側の見通しを保つために提供する。
function typeSingle(kana: string, keys: string) {
  return typeSequence([kana], keys);
}

// キー列がすべて受理され、かつ入力が完了することを検証する（単一読み用）
function expectCompletes(kana: string, keys: string) {
  const { state, rejected } = typeSingle(kana, keys);
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
      const { state } = typeSingle("ありがとう", "a");
      const result = typeKey(state, "x");
      expect(result.correct).toBe(false);
      expect(result.state).toBe(state);
    });

    it("間違ったキーの後も正しいキーで続行できる", () => {
      const { state, rejected } = typeSingle("ありがとう", "axrigatou");
      expect(rejected).toEqual(["x"]);
      expect(isFinished(state)).toBe(true);
    });

    it("入力完了後のキーはすべて拒否する", () => {
      const { state } = typeSingle("あ", "a");
      expect(isFinished(state)).toBe(true);
      const result = typeKey(state, "a");
      expect(result.correct).toBe(false);
      expect(result.state).toBe(state);
    });

    it("空文字列は最初から完了扱いになる", () => {
      expect(isFinished(createTypingState([""]))).toBe(true);
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
      const { state, rejected } = typeSingle("こんにちは", "konitiha");
      expect(rejected).toEqual(["i", "t", "i", "h", "a"]);
      expect(isFinished(state)).toBe(false);
    });

    it("次がや行なら nn が必要", () => {
      expectCompletes("こんや", "konnya");
      const { rejected } = typeSingle("こんや", "konya");
      expect(rejected).toContain("y");
    });

    it("次が母音なら nn が必要", () => {
      expectCompletes("げんいん", "genninn");
      const { rejected } = typeSingle("げんいん", "genin");
      expect(rejected).toContain("i");
    });

    it("末尾の「ん」は nn が必要", () => {
      expectCompletes("ほん", "honn");
      const { state, rejected } = typeSingle("ほん", "hon");
      expect(rejected).toEqual([]);
      expect(isFinished(state)).toBe(false);
    });

    it("単独 n の確定保留は次のモーラのキーで解決される", () => {
      // "nihon" の時点では「ん」は n/nn どちらか未確定で、
      // "g" が来た時点で「ん」を n で確定して「ご」の入力に移る
      const { state } = typeSingle("にほんご", "nihon");
      expect(isFinished(state)).toBe(false);
      const result = typeKey(state, "g");
      expect(result.correct).toBe(true);
      const track = result.state.tracks[0];
      expect(track.typed).toBe("nihon");
      expect(track.buffer).toBe("g");
    });

    it("末尾の「ん」で無効キーを送っても壊れず、その後 n は保留のまま受理される", () => {
      // 末尾の「ん」は nn/xn のみが候補（n 単独は不可）。
      // まず候補にない z を送って拒否されることを確認したうえで、
      // n を送ると（nn の前半として）受理はされるが末尾なので即確定はしない。
      const state = createTypingState(["ん"]);
      const rejected = typeKey(state, "z");
      expect(rejected.correct).toBe(false);
      expect(rejected.state).toBe(state);

      const accepted = typeKey(state, "n");
      expect(accepted.correct).toBe(true);
      expect(accepted.state.tracks[0].buffer).toBe("n");
      expect(isFinished(accepted.state)).toBe(false);
    });

    it("単独 n 確定保留中に次モーラへの継続もできないキーを送ると、状態を変えずに拒否する", () => {
      // 「んご」で n まで打った直後は「ん」が n で確定するか nn まで伸びるか未確定。
      // ここで g にも n の伸長にも一致しない z を送ると、
      // 「ん」を n で確定→「ご」に z を retry、のいずれも一致せず最終的に拒否される
      // （typeKey 内の commit-then-retry 分岐が「retry も失敗する」ケースを通る）。
      const { state } = typeSingle("んご", "n");
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
      const patterns = createTypingState(["んご"]).tracks[0].patterns;
      const stuckAtLastMora: TypingState = {
        tracks: [
          {
            patterns,
            unitIndex: 1, // 最後のモーラ「ご」を指している
            buffer: "go", // 唯一の候補と完全一致（本来なら即確定しているはずの状態）
            typed: "n",
          },
        ],
        activeMask: [true],
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
      const { rejected } = typeSingle("がっこう", "gas");
      expect(rejected).toEqual(["s"]);
    });
  });

  describe("複数の読み方", () => {
    it("代表読み（kanas[0]）どおりに打てば完了する", () => {
      const { state, rejected } = typeSequence(["うえ", "じょう", "かみ"], "ue");
      expect(rejected).toEqual([]);
      expect(isFinished(state)).toBe(true);
      // 代表読みが最後まで生き残ったので、activeKanaIndex は 0 のまま。
      expect(activeKanaIndex(state)).toBe(0);
    });

    it("代表読みと矛盾するキーで先頭アクティブが次の読みに切り替わる", () => {
      // "j" は「うえ」に一致しないが「じょう」の候補（ja/... / jyo/jo など）と一致する。
      // → 「うえ」トラックは脱落、activeKanaIndex は 1（「じょう」）に。
      const { state } = typeSequence(["うえ", "じょう", "かみ"], "j");
      expect(activeKanaIndex(state)).toBe(1);
      expect(state.activeMask).toEqual([false, true, false]);
    });

    it("先頭が切り替わったあとも打ち切れば完了する", () => {
      // 「じょう」を jou で完走する（jo は「じょ」= 1 モーラ、u は「う」）
      const { state, rejected } = typeSequence(["うえ", "じょう", "かみ"], "jou");
      expect(rejected).toEqual([]);
      expect(activeKanaIndex(state)).toBe(1);
      expect(isFinished(state)).toBe(true);
    });

    it("どの読みにも一致しないキーは全読み共通で拒否する（状態は不変）", () => {
      // "z" は「じょう」の候補 "zyo" と前方一致してしまうので、全読みで拒否させるには
      // どの候補にも属さない子音を選ぶ。"b" はどの読みの初手候補（u/wu, zyo/jo/jyo, ka/ca）にも含まれない。
      const state = createTypingState(["うえ", "じょう", "かみ"]);
      const result = typeKey(state, "b");
      expect(result.correct).toBe(false);
      expect(result.state).toBe(state);
    });

    it("先頭アクティブトラックが完了した時点で完了扱いになる（他のトラックが未完でも）", () => {
      // ["あ", "あん"] は代表読みが「あ」なので、"a" を打った瞬間に完了する。
      // 「あん」トラックはまだ末尾の「ん」が残っているが、先頭アクティブ（「あ」）が
      // 完了しているので isFinished は true。
      const { state } = typeSequence(["あ", "あん"], "a");
      expect(activeKanaIndex(state)).toBe(0);
      expect(isFinished(state)).toBe(true);
    });

    it("長い読みを先頭に置けば prefix の重複があっても長い方を完走できる", () => {
      // ["あん", "あ"] だと "a" で先頭「あん」は 1 モーラ目確定・残り「ん」。
      // 先頭アクティブは「あん」のまま未完で継続 → "nn" で完走。
      const { state, rejected } = typeSequence(["あん", "あ"], "ann");
      expect(rejected).toEqual([]);
      expect(activeKanaIndex(state)).toBe(0);
      expect(isFinished(state)).toBe(true);
    });

    it("入力完了後のキーは全読み共通で拒否する", () => {
      const { state } = typeSequence(["うえ", "じょう"], "ue");
      expect(isFinished(state)).toBe(true);
      const result = typeKey(state, "a");
      expect(result.correct).toBe(false);
      expect(result.state).toBe(state);
    });
  });
});

describe("romajiDisplay", () => {
  it("初期状態では全体が未入力", () => {
    const display = romajiDisplay(createTypingState(["こんにちは"]));
    expect(display.typed).toBe("");
    expect(display.remaining).toBe("konnnitiha");
  });

  it("「っ」は次のモーラの子音重ねを推奨表示にする", () => {
    const display = romajiDisplay(createTypingState(["がっこう"]));
    expect(display.remaining).toBe("gakkou");
  });

  it("入力済み部分と残り部分を分けて返す", () => {
    const { state } = typeSingle("こんにちは", "kon");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("kon");
    expect(display.remaining).toBe("nnitiha");
  });

  it("入力途中のモーラはバッファに一致する候補を残りに表示する", () => {
    // 「し」の推奨は si だが、"sh" まで打ったら shi の残り "i" を表示する
    const { state } = typeSingle("し", "sh");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("sh");
    expect(display.remaining).toBe("i");
  });

  it("「ん」の確定保留中は残りの表示に n を重複させない", () => {
    const { state } = typeSingle("にほんご", "nihon");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("nihon");
    expect(display.remaining).toBe("go");
  });

  it("入力完了後は残りが空になる", () => {
    const { state } = typeSingle("ありがとう", "arigatou");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("arigatou");
    expect(display.remaining).toBe("");
  });

  it("複数読みの初期状態は代表読み（kanas[0]）のローマ字を表示する", () => {
    const display = romajiDisplay(createTypingState(["うえ", "じょう"]));
    expect(display.typed).toBe("");
    expect(display.remaining).toBe("ue");
  });

  it("代表読みが脱落したら残りは次のアクティブ読みのローマ字に切り替わる", () => {
    // "j" を打つと「うえ」は脱落し、「じょう」トラックが先頭アクティブになる。
    // 「じょ」候補は zyo/jo/jyo。バッファ "j" に前方一致する候補は "jo" と "jyo" だが
    // .find() は候補配列の先頭側を優先するので "jo" が採用され、残りは "o" + 次モーラ「う」の
    // 先頭候補 "u" = "ou" になる。
    const { state } = typeSequence(["うえ", "じょう"], "j");
    const display = romajiDisplay(state);
    expect(display.typed).toBe("j");
    expect(display.remaining).toBe("ou");
  });

  it("バッファがどの候補とも前方一致しない不整合な状態でも、先頭候補にフォールバックして表示する", () => {
    // typeKey が返す TypingState では buffer は常にいずれかの候補の前方一致になるため、
    // このケースは通常のタイピングフローでは発生しない。
    // それでも romajiDisplay は表示専用の射影として「壊れずに何かしら妥当な残りを返す」
    // 契約を持たせてあるので、その契約自体を手動構築した TypingState で検証する。
    const patterns = createTypingState(["し"]).tracks[0].patterns; // 候補: si / shi / ci
    const inconsistent: TypingState = {
      tracks: [{ patterns, unitIndex: 0, buffer: "z", typed: "" }],
      activeMask: [true],
    };
    const display = romajiDisplay(inconsistent);
    // z はどの候補にも前方一致しないため、先頭候補 si にフォールバックし、
    // 残りは "z" を打ったあとの続きではなく si の buffer 分（1文字）を除いた "i" になる
    expect(display.remaining).toBe("i");
  });

  it("すべてのトラックが脱落した TypingState を渡すと throw する（不変条件違反）", () => {
    // 通常の typeKey 経路では最低 1 本アクティブが残る不変条件なので、
    // 全脱落 state は「実装バグ or 手動構築による不整合」を意味する。
    // buildPatterns の「未対応かな → throw」と同じ方針で silent に飲み込まない。
    const patterns = createTypingState(["し"]).tracks[0].patterns;
    const allInactive: TypingState = {
      tracks: [{ patterns, unitIndex: 0, buffer: "", typed: "" }],
      activeMask: [false],
    };
    expect(() => romajiDisplay(allInactive)).toThrow("不変条件違反");
  });
});

describe("activeKanaIndex", () => {
  it("初期状態は 0（代表読み）", () => {
    expect(activeKanaIndex(createTypingState(["うえ", "じょう"]))).toBe(0);
  });

  it("先頭が脱落したら次のアクティブ index を返す", () => {
    const { state } = typeSequence(["うえ", "じょう"], "j");
    expect(activeKanaIndex(state)).toBe(1);
  });

  it("すべて脱落している場合は throw する（不変条件違反）", () => {
    const patterns = createTypingState(["し"]).tracks[0].patterns;
    const state: TypingState = {
      tracks: [{ patterns, unitIndex: 0, buffer: "", typed: "" }],
      activeMask: [false],
    };
    expect(() => activeKanaIndex(state)).toThrow("不変条件違反");
  });
});

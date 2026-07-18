// かな→ローマ字入力判定エンジン。
// かな文字列をモーラ（拗音を含む入力単位）に分割し、各モーラに複数のローマ字候補を
// 持たせて、1打鍵ごとに前方一致で正誤を判定する。

// 各モーラの候補綴り。先頭の候補が表示上の推奨綴りとして使われる。
const MORA_TABLE: Record<string, string[]> = {
  あ: ["a"],
  い: ["i", "yi"],
  う: ["u", "wu"],
  え: ["e"],
  お: ["o"],
  か: ["ka", "ca"],
  き: ["ki"],
  く: ["ku", "cu", "qu"],
  け: ["ke"],
  こ: ["ko", "co"],
  さ: ["sa"],
  し: ["si", "shi", "ci"],
  す: ["su"],
  せ: ["se", "ce"],
  そ: ["so"],
  た: ["ta"],
  ち: ["ti", "chi"],
  つ: ["tu", "tsu"],
  て: ["te"],
  と: ["to"],
  な: ["na"],
  に: ["ni"],
  ぬ: ["nu"],
  ね: ["ne"],
  の: ["no"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu", "hu"],
  へ: ["he"],
  ほ: ["ho"],
  ま: ["ma"],
  み: ["mi"],
  む: ["mu"],
  め: ["me"],
  も: ["mo"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  を: ["wo"],
  が: ["ga"],
  ぎ: ["gi"],
  ぐ: ["gu"],
  げ: ["ge"],
  ご: ["go"],
  ざ: ["za"],
  じ: ["zi", "ji"],
  ず: ["zu"],
  ぜ: ["ze"],
  ぞ: ["zo"],
  だ: ["da"],
  ぢ: ["di"],
  づ: ["du"],
  で: ["de"],
  ど: ["do"],
  ば: ["ba"],
  び: ["bi"],
  ぶ: ["bu"],
  べ: ["be"],
  ぼ: ["bo"],
  ぱ: ["pa"],
  ぴ: ["pi"],
  ぷ: ["pu"],
  ぺ: ["pe"],
  ぽ: ["po"],
  きゃ: ["kya"],
  きゅ: ["kyu"],
  きょ: ["kyo"],
  しゃ: ["sya", "sha"],
  しゅ: ["syu", "shu"],
  しょ: ["syo", "sho"],
  ちゃ: ["tya", "cha", "cya"],
  ちゅ: ["tyu", "chu", "cyu"],
  ちょ: ["tyo", "cho", "cyo"],
  にゃ: ["nya"],
  にゅ: ["nyu"],
  にょ: ["nyo"],
  ひゃ: ["hya"],
  ひゅ: ["hyu"],
  ひょ: ["hyo"],
  みゃ: ["mya"],
  みゅ: ["myu"],
  みょ: ["myo"],
  りゃ: ["rya"],
  りゅ: ["ryu"],
  りょ: ["ryo"],
  ぎゃ: ["gya"],
  ぎゅ: ["gyu"],
  ぎょ: ["gyo"],
  じゃ: ["zya", "ja", "jya"],
  じゅ: ["zyu", "ju", "jyu"],
  じょ: ["zyo", "jo", "jyo"],
  びゃ: ["bya"],
  びゅ: ["byu"],
  びょ: ["byo"],
  ぴゃ: ["pya"],
  ぴゅ: ["pyu"],
  ぴょ: ["pyo"],
  ふぁ: ["fa"],
  ふぃ: ["fi"],
  ふぇ: ["fe"],
  ふぉ: ["fo"],
  ぁ: ["la", "xa"],
  ぃ: ["li", "xi"],
  ぅ: ["lu", "xu"],
  ぇ: ["le", "xe"],
  ぉ: ["lo", "xo"],
  ゃ: ["lya", "xya"],
  ゅ: ["lyu", "xyu"],
  ょ: ["lyo", "xyo"],
  ー: ["-"],
};

const SOKUON_FALLBACKS = ["ltu", "xtu", "ltsu"];

export type MoraPattern = {
  kana: string;
  candidates: string[];
};

// 「ん」を単独の "n" で入力できない文脈かどうか。
// 次のモーラが母音・な行・や行で始まる場合（または「ん」が末尾の場合）は
// "n" 1打では確定できないため "nn" などを必須にする。
function requiresDoubleN(next: MoraPattern | undefined): boolean {
  if (!next) return true;
  return next.candidates.some((c) => /^[aiueony]/.test(c));
}

// 「っ」の候補。次のモーラの各候補の先頭子音を重ねる打ち方と、
// "ltu" などの単独入力の両方を許容する。
function sokuonCandidates(next: MoraPattern | undefined): string[] {
  const doubled: string[] = [];
  if (next) {
    for (const c of next.candidates) {
      const head = c[0];
      if (head !== undefined && !/[aiueon]/.test(head) && !doubled.includes(head)) {
        doubled.push(head);
      }
    }
  }
  return [...doubled, ...SOKUON_FALLBACKS];
}

export function buildPatterns(kana: string): MoraPattern[] {
  // まずかな文字列をモーラ（拗音は2文字で1単位）に分割する
  const units: string[] = [];
  let i = 0;
  while (i < kana.length) {
    const two = kana.slice(i, i + 2);
    if (two.length === 2 && MORA_TABLE[two]) {
      units.push(two);
      i += 2;
    } else {
      units.push(kana[i]);
      i += 1;
    }
  }

  // 「ん」「っ」は次のモーラに依存するため、末尾から候補を確定していく
  const patterns: MoraPattern[] = new Array(units.length);
  for (let j = units.length - 1; j >= 0; j--) {
    const unit = units[j];
    const next = patterns[j + 1];
    if (unit === "ん") {
      const candidates = requiresDoubleN(next) ? ["nn", "xn"] : ["n", "nn", "xn"];
      patterns[j] = { kana: unit, candidates };
    } else if (unit === "っ") {
      patterns[j] = { kana: unit, candidates: sokuonCandidates(next) };
    } else {
      const candidates = MORA_TABLE[unit];
      if (!candidates) {
        throw new Error(`未対応のかな文字です: ${unit}`);
      }
      patterns[j] = { kana: unit, candidates };
    }
  }
  return patterns;
}

export type TypingState = {
  patterns: MoraPattern[];
  // 確定済みモーラのインデックス（patterns[unitIndex] が現在入力中のモーラ）
  unitIndex: number;
  // 現在のモーラに対して入力済みのローマ字
  buffer: string;
  // 確定済みモーラの入力ローマ字の連結
  typed: string;
};

export function createTypingState(kana: string): TypingState {
  return { patterns: buildPatterns(kana), unitIndex: 0, buffer: "", typed: "" };
}

export function isFinished(state: TypingState): boolean {
  return state.unitIndex >= state.patterns.length;
}

export type TypeKeyResult = {
  state: TypingState;
  correct: boolean;
};

// 現在のモーラのバッファにキーを足して確定・継続を判定する。
// バッファが候補に完全一致し、かつそれより長い候補が残っていなければモーラを確定する。
// （例: 「ん」の "n" は "nn" が残っているため即確定せず、次のキーで解決する）
function advance(state: TypingState, key: string): TypingState | null {
  const pattern = state.patterns[state.unitIndex];
  if (!pattern) return null;
  const nextBuffer = state.buffer + key;
  const matches = pattern.candidates.filter((c) => c.startsWith(nextBuffer));
  if (matches.length === 0) return null;

  const exact = matches.includes(nextBuffer);
  const hasLonger = matches.some((c) => c.length > nextBuffer.length);
  if (exact && !hasLonger) {
    return {
      ...state,
      unitIndex: state.unitIndex + 1,
      buffer: "",
      typed: state.typed + nextBuffer,
    };
  }
  return { ...state, buffer: nextBuffer };
}

export function typeKey(state: TypingState, key: string): TypeKeyResult {
  if (isFinished(state)) return { state, correct: false };

  const advanced = advance(state, key);
  if (advanced) return { state: advanced, correct: true };

  // 現在のバッファが候補に完全一致している場合（「ん」の "n" など）は
  // モーラを確定させたうえで、同じキーを次のモーラに適用し直す
  const pattern = state.patterns[state.unitIndex];
  if (pattern && pattern.candidates.includes(state.buffer)) {
    const settled: TypingState = {
      ...state,
      unitIndex: state.unitIndex + 1,
      buffer: "",
      typed: state.typed + state.buffer,
    };
    const retried = advance(settled, key);
    if (retried) return { state: retried, correct: true };
  }

  return { state, correct: false };
}

export type RomajiDisplay = {
  typed: string;
  remaining: string;
};

// 表示用のローマ字列。入力済み部分と、現在の入力状況に沿った残り部分を返す。
export function romajiDisplay(state: TypingState): RomajiDisplay {
  const typed = state.typed + state.buffer;
  let remaining = "";
  const current = state.patterns[state.unitIndex];
  if (current) {
    const candidate =
      current.candidates.find((c) => c.startsWith(state.buffer)) ?? current.candidates[0];
    remaining += candidate.slice(state.buffer.length);
  }
  for (let i = state.unitIndex + 1; i < state.patterns.length; i++) {
    remaining += state.patterns[i].candidates[0];
  }
  return { typed, remaining };
}

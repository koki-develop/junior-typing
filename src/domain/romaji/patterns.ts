// かなをモーラ（拗音を含む入力単位）に分割し、各モーラに複数のローマ字候補を持たせる。
// 「ん」「っ」は次のモーラに応じて候補が変わるため、末尾から確定していく。

import { MORA_TABLE, SOKUON_FALLBACKS } from "./moraTable.ts";

export type MoraPattern = {
  kana: string;
  candidates: string[];
};

// 「ん」を単独の "n" で入力できない文脈かどうか。
// 次のモーラが母音・な行・や行で始まる場合（または「ん」が末尾の場合）は
// "n" 1打では確定できないため "nn" などを必須にする。
export function requiresDoubleN(next: MoraPattern | undefined): boolean {
  if (!next) return true;
  return next.candidates.some((c) => /^[aiueony]/.test(c));
}

// 「っ」の候補。次のモーラの各候補の先頭子音を重ねる打ち方と、
// "ltu" などの単独入力の両方を許容する。
export function sokuonCandidates(next: MoraPattern | undefined): string[] {
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

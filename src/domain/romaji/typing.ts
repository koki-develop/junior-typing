// モーラパターンをもとに、1打鍵ごとに前方一致で正誤を判定する状態遷移。

import type { MoraPattern } from "./patterns.ts";
import { buildPatterns } from "./patterns.ts";

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

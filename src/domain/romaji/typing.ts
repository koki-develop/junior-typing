// モーラパターンをもとに、1打鍵ごとに前方一致で正誤を判定する状態遷移。
//
// 「複数の読み方」対応:
//   1問に対して複数の「読み方」（かな）を受理できるようにするため、
//   TypingState は各読み方に対応するトラック（TypingTrack）を並列に保持する。
//   打鍵ごとに全アクティブトラックに同じキーを試し、受理したものだけを残す。
//   ユーザーへの表示（ふりがな／ローマ字ヒント）と完了判定は常に
//   「先頭のアクティブトラック」を基準に統一する:
//     - 初期は kanas[0]（代表読み）が先頭アクティブ
//     - 代表読みと矛盾するキーで先頭が脱落したら、次のアクティブトラックへ切り替わる
//     - 「先頭のアクティブトラックが完了」＝ゲーム上の完了
//   この一貫性により、「見えている通りに打ち切ったら done」というシンプルな体験に揃う。
//   結果として prefix が重複する読み方（例 ["あ", "あん"]）は「短い方を先頭に置いた時点で
//   長い方が到達不能」というデータ規約に落ちる（types.ts のコメント参照）。

import type { MoraPattern } from "./patterns.ts";
import { buildPatterns } from "./patterns.ts";

// 1 つの読み方に対する内部状態。従来の TypingState をそのままトラックに切り出したもの。
export type TypingTrack = {
  patterns: MoraPattern[];
  // 確定済みモーラのインデックス（patterns[unitIndex] が現在入力中のモーラ）
  unitIndex: number;
  // 現在のモーラに対して入力済みのローマ字
  buffer: string;
  // 確定済みモーラの入力ローマ字の連結
  typed: string;
};

export type TypingState = {
  // 生成時の kanas と同じ順序・同じ長さで、各読み方のトラックを保持する。
  // 「脱落済み」のトラックも tracks には残し、activeMask で on/off を切り替える。
  // こうすることで「kanas の何番目の読みが今アクティブか」を activeKanaIndex で
  // そのまま外部に返せる（tracks の順序が kanas の順序と一致するため）。
  tracks: TypingTrack[];
  activeMask: boolean[];
};

function createTrack(kana: string): TypingTrack {
  return { patterns: buildPatterns(kana), unitIndex: 0, buffer: "", typed: "" };
}

export function createTypingState(kanas: readonly string[]): TypingState {
  const tracks = kanas.map(createTrack);
  return { tracks, activeMask: tracks.map(() => true) };
}

// 「先頭のアクティブトラック」の index を返す唯一の内部 helper。
// 表示・完了判定・view 層のふりがな切替はすべてこれを経由することで、
// 「先頭アクティブ」の定義がぶれないようにする。
//
// 通常の typeKey 経路では最低 1 本のアクティブトラックが残る不変条件が保たれるため、
// findIndex === -1 は「実装バグ or 手動構築の不整合 state」を意味する。
// buildPatterns の「未対応かな → throw」と同じ方針で、ここで throw して落とす。
// domain.md の「Domain functions do not defend this contract with runtime guards」
// に従い、-1 を silent に飲み込むフォールバックは持たない。
function firstActiveIndex(state: TypingState): number {
  const idx = state.activeMask.findIndex((a) => a);
  if (idx < 0) {
    throw new Error("TypingState にアクティブなトラックが 1 本も残っていません（不変条件違反）");
  }
  return idx;
}

// 「先頭のアクティブトラック」の index を外部公開する。View 層がふりがな表示や
// question.kanas[idx] の切替に使う。
export function activeKanaIndex(state: TypingState): number {
  return firstActiveIndex(state);
}

function isTrackFinished(track: TypingTrack): boolean {
  return track.unitIndex >= track.patterns.length;
}

// 「先頭アクティブトラックが完了しているか」で判定する。
// 別のアクティブトラックがまだ未完了でも、先頭が終わっている＝ユーザーが見えている通りに
// 打ち切った、なので完了扱い。
export function isFinished(state: TypingState): boolean {
  return isTrackFinished(state.tracks[firstActiveIndex(state)]);
}

export type TypeKeyResult = {
  state: TypingState;
  correct: boolean;
};

// 現在のモーラのバッファにキーを足して確定・継続を判定する。
// バッファが候補に完全一致し、かつそれより長い候補が残っていなければモーラを確定する。
// （例: 「ん」の "n" は "nn" が残っているため即確定せず、次のキーで解決する）
function advanceTrack(track: TypingTrack, key: string): TypingTrack | null {
  const pattern = track.patterns[track.unitIndex];
  if (!pattern) return null;
  const nextBuffer = track.buffer + key;
  const matches = pattern.candidates.filter((c) => c.startsWith(nextBuffer));
  if (matches.length === 0) return null;

  const exact = matches.includes(nextBuffer);
  const hasLonger = matches.some((c) => c.length > nextBuffer.length);
  if (exact && !hasLonger) {
    return {
      ...track,
      unitIndex: track.unitIndex + 1,
      buffer: "",
      typed: track.typed + nextBuffer,
    };
  }
  return { ...track, buffer: nextBuffer };
}

function typeKeyTrack(track: TypingTrack, key: string): TypingTrack | null {
  if (isTrackFinished(track)) return null;

  const advanced = advanceTrack(track, key);
  if (advanced) return advanced;

  // 現在のバッファが候補に完全一致している場合（「ん」の "n" など）は
  // モーラを確定させたうえで、同じキーを次のモーラに適用し直す
  const pattern = track.patterns[track.unitIndex];
  if (pattern && pattern.candidates.includes(track.buffer)) {
    const settled: TypingTrack = {
      ...track,
      unitIndex: track.unitIndex + 1,
      buffer: "",
      typed: track.typed + track.buffer,
    };
    const retried = advanceTrack(settled, key);
    if (retried) return retried;
  }

  return null;
}

// すべてのアクティブトラックに同じキーを試み、
//   - 1 本でも受理されたら、受理したトラックのみアクティブに残し correct: true
//   - 全部拒否されたら、状態を変えず（同一参照）に correct: false
// を返す。
//
// 「先頭アクティブトラックが完了している状態でさらに打鍵が来る」ケースは
// isFinished(state) の早期リターンで拒否しており、
// 後続の "アクティブトラックの入れ替わり" は起こらない。
export function typeKey(state: TypingState, key: string): TypeKeyResult {
  if (isFinished(state)) return { state, correct: false };

  const nextTracks = state.tracks.slice();
  const nextMask = state.activeMask.slice();
  let anyAccepted = false;
  for (let i = 0; i < state.tracks.length; i++) {
    if (!state.activeMask[i]) continue;
    const advanced = typeKeyTrack(state.tracks[i], key);
    if (advanced) {
      nextTracks[i] = advanced;
      anyAccepted = true;
    } else {
      nextMask[i] = false;
    }
  }

  if (!anyAccepted) {
    return { state, correct: false };
  }
  return { state: { tracks: nextTracks, activeMask: nextMask }, correct: true };
}

export type RomajiDisplay = {
  typed: string;
  remaining: string;
};

// 表示用のローマ字列。入力済み部分と、現在の入力状況に沿った残り部分を返す。
// 「先頭のアクティブトラック」を基準に描画するので、代表読みが脱落した瞬間に
// 次のアクティブ読みのローマ字ヒントへ切り替わる。
export function romajiDisplay(state: TypingState): RomajiDisplay {
  return romajiDisplayForTrack(state.tracks[firstActiveIndex(state)]);
}

function romajiDisplayForTrack(track: TypingTrack): RomajiDisplay {
  const typed = track.typed + track.buffer;
  let remaining = "";
  const current = track.patterns[track.unitIndex];
  if (current) {
    const candidate =
      current.candidates.find((c) => c.startsWith(track.buffer)) ?? current.candidates[0];
    remaining += candidate.slice(track.buffer.length);
  }
  for (let i = track.unitIndex + 1; i < track.patterns.length; i++) {
    remaining += track.patterns[i].candidates[0];
  }
  return { typed, remaining };
}

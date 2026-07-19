// 結果画面で表示する統計・スコアを純粋関数として算出する。
// 状態機械（machine.ts）は打鍵カウントと開始/終了時刻の記録だけを担い、
// そこからの派生値（経過時間・スコア）はここに一本化する。

import type { PlayingStats } from "./machine.ts";

export type GameResult = {
  correctKeys: number;
  wrongKeys: number;
  totalKeys: number;
  elapsedMs: number;
  score: number;
};

// スコア係数。小学生向けに「正確に速く」を促す単純な加減点式。
// - 正解キー1つにつき +CORRECT_POINTS
// - ミスキー1つにつき -WRONG_PENALTY
// - 経過秒（切り捨て）1秒につき -TIME_PENALTY_PER_SEC
// 最終的に 0 でクランプする。
export const CORRECT_POINTS = 10;
export const WRONG_PENALTY = 5;
export const TIME_PENALTY_PER_SEC = 1;

export function computeResult(stats: PlayingStats, endedAt: number): GameResult {
  // タイマー精度のブレや同一 tick 内の連続イベントで endedAt < startedAt になる可能性は無いはずだが、
  // 負の経過時間だけは表示上ありえない値なので 0 でクランプする（実害はないが表示の安全弁）。
  const elapsedMs = Math.max(0, endedAt - stats.startedAt);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const raw =
    stats.correctKeys * CORRECT_POINTS -
    stats.wrongKeys * WRONG_PENALTY -
    elapsedSec * TIME_PENALTY_PER_SEC;
  return {
    correctKeys: stats.correctKeys,
    wrongKeys: stats.wrongKeys,
    totalKeys: stats.correctKeys + stats.wrongKeys,
    elapsedMs,
    score: Math.max(0, raw),
  };
}

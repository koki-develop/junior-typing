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

// スコア設計:
//   score = round(accuracy + speed) ∈ [0, ACCURACY_MAX + SPEED_MAX] = [0, 1000]
// 問題セットのキー総数はセットごとにも入力ルートごとにも異なるため、
// 「累積型（キー数×定数）」だと満点がセット依存になってしまう。
// どのセットでも 1,000 を到達可能にするため、絶対量ではなくレート
// （正解率・キー/秒）で評価する。
//
// - 精度パート（最大 ACCURACY_MAX）
//     accuracy = ACCURACY_MAX * correctKeys / totalKeys
//   ミスなし（wrongKeys = 0）で満点。ミスは線形に減点。
// - 速度パート（最大 SPEED_MAX）
//     activeMs   = elapsedMs - clearedMs  … 実際に打鍵可能だった時間
//     actualKps  = correctKeys / (activeMs / 1000)
//     speed = min(1, actualKps / TARGET_KEYS_PER_SEC) * SPEED_MAX
//   TARGET_KEYS_PER_SEC 以上のレートで満点。それ以下は比例で減点。
//   ※ elapsedMs には各問クリア演出（machine.ts の CLEAR_DELAY_MS × 問題数）が
//      含まれるが、その間は入力不可なので stats.clearedMs で差し引いて評価する。
//
// 端値ケース:
//   - totalKeys = 0（本来は done 到達後の呼び出しなのでありえないが、
//     単体呼び出しの境界を守るため）: 0/0 を避けて score = 0。
//   - activeMs = 0（elapsedMs のクランプ由来、または clearedMs >= elapsedMs の
//     数値誤差ケース）: レートを "十分速い" とみなして速度パートを満点扱い。
export const ACCURACY_MAX = 700;
export const SPEED_MAX = 300;
// 満点。上記 2 パートの和として一意に決まる派生値だが、
// - services/highScores.ts の入力バリデーション上限
// - トップページの「パーフェクト（1000）」判定
// のように「満点そのもの」を扱う呼び出し側があり、その都度 ACCURACY_MAX + SPEED_MAX を
// 書き直させると意味の重複と加算漏れの温床になる。ここで一度だけ定義して配布する。
export const MAX_SCORE = ACCURACY_MAX + SPEED_MAX;

// 「このスコアはパーフェクト（満点）か？」の判定。
// UI が === MAX_SCORE を素で書くと、将来スコア設計が変わって「満点」の定義が
// 「両パート個別に満点を取る」等の複合条件に化けたときに TopPage 側は静かに嘘を返し続ける。
// 満点の意味の権威をここに一本化する。
export function isPerfectScore(score: number): boolean {
  return score === MAX_SCORE;
}
// 目標打鍵レート（キー/秒）。これ以上のレートで速度満点。小学生の
// 中〜高学年で頑張って到達できる 120 kpm 前後の水準を狙う。
export const TARGET_KEYS_PER_SEC = 2;

export function computeResult(stats: PlayingStats, endedAt: number): GameResult {
  // タイマー精度のブレや同一 tick 内の連続イベントで endedAt < startedAt になる可能性は無いはずだが、
  // 負の経過時間だけは表示上ありえない値なので 0 でクランプする（実害はないが表示の安全弁）。
  const elapsedMs = Math.max(0, endedAt - stats.startedAt);
  // 入力不可時間（クリア演出中）を差し引いた「打鍵可能だった時間」。
  // clearedMs > elapsedMs にはならないはずだが、0 でクランプしておく。
  const activeMs = Math.max(0, elapsedMs - stats.clearedMs);
  const totalKeys = stats.correctKeys + stats.wrongKeys;

  let score: number;
  if (totalKeys === 0) {
    // ゲーム完了到達なら correctKeys >= 1 のはずだが、0/0 を避けるガード。
    score = 0;
  } else {
    const accuracy = (ACCURACY_MAX * stats.correctKeys) / totalKeys;
    // activeMs = 0 のときは "十分速い" 扱いで速度満点。それ以外は
    // actualKps / TARGET_KEYS_PER_SEC を 1 でクランプする。
    const speedFrac =
      activeMs === 0
        ? 1
        : Math.min(1, (stats.correctKeys * 1000) / (activeMs * TARGET_KEYS_PER_SEC));
    const speed = SPEED_MAX * speedFrac;
    score = Math.round(accuracy + speed);
  }

  return {
    correctKeys: stats.correctKeys,
    wrongKeys: stats.wrongKeys,
    totalKeys,
    elapsedMs,
    score,
  };
}

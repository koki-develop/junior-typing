// 問題セットごとのハイスコアを localStorage に永続化する薄いアダプタ。
// domain 層は純ロジックのままにしておきたい（localStorage は "外の世界"）ので、
// sound.ts と同じく services 層に置く。
//
// 保存対象は「そのセットの過去最高スコアのみ」。2 位以下や履歴・タイムスタンプは保持しない。
// 呼び出し側の TOCTOU 回避のため、比較〜書き込みは recordHighScore に閉じ込め、
// 外に「読んで比較して書く」オーケストレーションを漏らさない。

import { MAX_SCORE } from "../domain/game/score.ts";

// localStorage 上のキー。プロジェクト名スコープ + スキーマバージョンサフィックス。
// スキーマを非互換に変えたら :v2 に上げてキーごと切り替える方針（マイグレーションは書かない）。
const STORAGE_KEY = "junior-typing:high-scores:v1";

// 読み出し時のバリデーションで score.ts の設計上の満点を上限に使う。
// 定数そのものを domain から受け取っているので、スコア設計の変更に自動で追従する。

// localStorage 自体が使えない環境（SSR / node の unit テスト / 一部プライベートモード）で
// クラッシュしないように、window / localStorage の参照は try/catch で包む。
// SecurityError で property アクセスすら投げるブラウザがあるため、getItem/setItem だけでなく
// 参照取得自体も try で守る。
function getStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

function isValidScore(value: unknown): value is number {
  // Number.isInteger は NaN / Infinity / 非数を全て false にする。
  // 上限は domain の満点で押さえる（改ざん耐性の最低限）。
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

// 単一 JSON blob として全セット分をまとめて読み出す。破損・型不一致・個別値の異常は
// 「そのエントリだけ無かった」ものとして落とし、残りは返す（全消しは過剰）。
function readAll(): Record<string, number> {
  const storage = getStorage();
  if (!storage) return {};

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {};
  }
  if (raw === null) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  // 配列や null は typeof "object" になるので、プレーンなレコード形以外は破損扱い。
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isValidScore(value)) result[key] = value;
  }
  return result;
}

function writeAll(scores: Record<string, number>): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // QuotaExceededError / SecurityError など。ハイスコアが保存できないのは
    // ゲーム進行にとって致命ではないので、握り潰してユーザー体験を止めない。
  }
}

// 指定セットのハイスコアを取得。未登録・破損時は null。
export function getHighScore(setId: string): number | null {
  const scores = readAll();
  return scores[setId] ?? null;
}

// 全セットのハイスコアを一括取得。トップページの一覧表示用に用意しておく。
export function getAllHighScores(): Record<string, number> {
  return readAll();
}

// 与えられたスコアが既存のハイスコアより真に高いときだけ書き込む冪等な記録依頼。
// 同点は「更新なし」扱い（無駄な書き込みを避け、UI 側で "新記録" 演出を出せる境界を明確にする）。
// previousHigh は UI 側の「前回スコアからの差分表示」用に返す。
export function recordHighScore(
  setId: string,
  score: number,
): { previousHigh: number | null; isNewHigh: boolean } {
  const scores = readAll();
  const previousHigh = scores[setId] ?? null;
  if (previousHigh !== null && score <= previousHigh) {
    return { previousHigh, isNewHigh: false };
  }
  scores[setId] = score;
  writeAll(scores);
  return { previousHigh, isNewHigh: true };
}

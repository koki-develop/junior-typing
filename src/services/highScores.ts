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

// recordHighScore / evaluateHighScore の返り値。UI 側が "新記録演出" と "前回スコアの
// 参考表示" を分岐するのに必要な最小情報。呼び出し側で inline 型を書き回すと、UI 経路
// （PlayPage → ResultScreen）を跨ぐ prop 型で二重管理になるため export する。
export type HighScoreInfo = {
  previousHigh: number | null;
  isNewHigh: boolean;
};

// 指定セットに対して「このスコアは新記録か」を副作用なしで判定する純関数版。
// 同点は「更新なし」扱い（recordHighScore と同じルール）。
//
// なぜ recordHighScore と分けているか:
//   React の render 中で "新記録かどうか" を判定したい呼び出し側（PlayPage の derived
//   state）は、書き込みを伴わない読み取りだけの API を必要とする。書き込みを含む
//   recordHighScore を render 中に置くと、React Strict Mode の double-invoke で
//   1 回目の書き込みが 2 回目の読み取り結果を反転させ、isNewHigh が false 化する。
//   読み取り（判定）と書き込み（永続化）の責務を分けて、render は evaluate、
//   コミット後の useEffect は record を呼ぶ、という構成を成立させるための API。
//
// 実装は readAll だけ叩く。「未登録」「同点」「新記録」の 3 分岐を recordHighScore と
// 一致させる唯一の場所にしておくことで、両 API の isNewHigh 判定が silently 分岐する
// ことを避ける（recordHighScore はこの関数を経由して判定する）。
export function evaluateHighScore(setId: string, score: number): HighScoreInfo {
  const previousHigh = readAll()[setId] ?? null;
  const isNewHigh = previousHigh === null || score > previousHigh;
  return { previousHigh, isNewHigh };
}

// 与えられたスコアが既存のハイスコアより真に高いときだけ書き込む冪等な記録依頼。
// 判定ロジック本体は evaluateHighScore に一本化してある。ここでは判定結果に基づいて
// 「新記録なら書き込む」オーケストレーションだけを担う。
// 同点は「更新なし」扱い（無駄な書き込みを避け、UI 側で "新記録" 演出を出せる境界を明確にする）。
// previousHigh は UI 側の「前回スコアからの差分表示」用に返す。
export function recordHighScore(setId: string, score: number): HighScoreInfo {
  const info = evaluateHighScore(setId, score);
  if (!info.isNewHigh) return info;
  // 判定用の readAll と書き込み前の readAll は別スナップショット。同一 tick 内で
  // 他セットへの書き込みが挟まる余地は本アプリには無いが、readAll を 2 度叩くだけの
  // コストで「他セットのハイスコアを踏まない」保証が得られるので二段構えにする。
  const scores = readAll();
  scores[setId] = score;
  writeAll(scores);
  return info;
}

import type { Question } from "./types.ts";

// pool から重複なく count 件を無作為抽出する。Fisher-Yates で pool 全体をシャッフルしてから
// 先頭 count 件を切り出すことで、「どれを出題するか（抽出）」と「どの順で出題するか（並び替え）」
// を1回の操作で同時にランダム化する。
// random は [0, 1) を返す関数（既定は Math.random）。テストでは決定的な関数を注入して
// 結果を再現できる。
//
// 前提契約: count は 1 以上 pool.length 以下であること（questions.test.ts が保証する）。
// buildPatterns の「未対応のかな文字」と同じ方針で、この関数自身はその前提のランタイム防御を
// 持たない — データ不正は CI で落とす。
export function selectQuestions(
  pool: readonly Question[],
  count: number,
  random: () => number = Math.random,
): Question[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

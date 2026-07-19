import { useState } from "react";
import { getAllHighScores } from "../../services/highScores.ts";

// トップページなど「複数の問題セットのハイスコアを一覧したい」呼び出し側から使う React glue。
// services/highScores.ts の getAllHighScores を「React の描画寿命 = マウント〜アンマウント」に
// 揃えて 1 回だけ叩き、Record<setId, number> を返す。setId は QuestionSet.id で、未記録の
// setId はキーが存在しない（呼び出し側で `?? null` などのフォールバックが必要）。
//
// マウント時 snapshot 方式にしている前提:
//   /play/$setId から / に戻ってきたときに TopPage が unmount → mount しなおされる
//   （router.tsx の rootRoute の直下に / と /play/$setId がフラットに並んでいるため、
//   両者はレイアウトを共有しない）。よってプレイ後の新記録は「戻る」による再マウントで
//   自動的に反映される。もし将来 / と /play/$setId を包む共通 layout route を挟むと、
//   TopPage が unmount されなくなり、この snapshot は silent に stale になる。
//   → router.tsx 側にもコメントを残してあり、topology を変える人は本フックの前提を
//   見直すことになる。将来的にサブスクリプション方式（useSyncExternalStore）に切り替える
//   ときも差し替えはこのフック内で閉じる。
//
// なぜ services を直接呼ばずにフックを噛ませるか:
//   src/features/ は「React glue を集約する層」（CLAUDE.md のアーキテクチャ定義）。pages が
//   services の呼び出しを直接ホストすると、同じ「ハイスコアを React 側に持ち上げる」ロジックが
//   将来別ページ（例: ヘッダのバッジ）で再実装される温床になる。玄関口をここに一本化する。
export function useHighScores(): Record<string, number> {
  const [highScores] = useState(() => getAllHighScores());
  return highScores;
}

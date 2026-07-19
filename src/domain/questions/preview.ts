import type { QuestionSet } from "./types.ts";

// トップページのカードに載せる「セットに何が入っているかのプレビュー」を作る。
// アイコンなどは使わず、実データそのものを見せる方針なので、先頭 max 件の text を
// 「・」で連結するだけの純粋関数にする（余った分は呼び出し側で CSS 側 truncate）。
// 末尾の「…」は付けない — テキストが長ければブラウザの text-overflow: ellipsis が
// 描画するので、データ側で余計な記号を持たない。
export function previewWords(set: QuestionSet, max = 8): string {
  return set.questions
    .slice(0, max)
    .map((q) => q.text)
    .join("・");
}

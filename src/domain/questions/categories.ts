// QuestionSet.category（string）が参照する「カテゴリ」の定義。
// color は #rrggbb のテーマカラーで、カード分け等の将来のデザイン拡張用メタデータ。
// 現状はどこからも参照していない（未使用）。
export type Category = {
  id: string;
  label: string;
  color: string;
};

export const CATEGORIES: Category[] = [
  { id: "animals", label: "どうぶつ", color: "#d97706" },
  { id: "foods", label: "たべもの", color: "#ef4444" },
  { id: "vehicles", label: "のりもの", color: "#3b82f6" },
  { id: "sports", label: "スポーツ", color: "#22c55e" },
  { id: "school", label: "がっこう", color: "#a855f7" },
];

// QuestionSet.category からカテゴリを解決する共通ヘルパ。
export function findCategory(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

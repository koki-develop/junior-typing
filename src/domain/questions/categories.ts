// QuestionSet.category（string）が参照する「カテゴリ」の定義。
// label はトップページのカテゴリ見出しに表示され、color は同カテゴリ見出し横の
// アクセントドットの背景色として使われる（TopPage.tsx 参照）。id は
// QuestionSet.category からの被参照キーで、URL には出ないので日本語不可というほどではないが
// 慣例上 ASCII で保つ。
export type Category = {
  id: string;
  label: string;
  color: string;
};

export const CATEGORIES: Category[] = [
  { id: "hiragana", label: "ひらがな", color: "#ec4899" },
  { id: "kanji", label: "かん字", color: "#14b8a6" },
  { id: "animals", label: "いきもの", color: "#d97706" },
  { id: "foods", label: "たべもの", color: "#ef4444" },
  { id: "vehicles", label: "のりもの", color: "#3b82f6" },
  { id: "sports", label: "スポーツ", color: "#22c55e" },
  { id: "school", label: "がっこう", color: "#a855f7" },
];

// QuestionSet.category からカテゴリを解決する共通ヘルパ。
export function findCategory(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

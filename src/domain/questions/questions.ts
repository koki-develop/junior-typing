import type { QuestionSet } from "./types.ts";

// 動作確認用のサンプルセット。将来的に実運用の問題セットが追加されたら削除する想定。
export const questionSets: QuestionSet[] = [
  {
    id: "sample",
    title: "サンプル",
    questions: [
      { text: "こんにちは", kana: "こんにちは" },
      { text: "ありがとう", kana: "ありがとう" },
      { text: "学校へ行く", kana: "がっこうへいく" },
      { text: "日本語", kana: "にほんご" },
      { text: "お茶を飲む", kana: "おちゃをのむ" },
    ],
  },
];

// URL から渡ってきた setId をセットに解決する共通ヘルパ。
// 見つからない場合は undefined を返し、呼び出し側（ルータの beforeLoad）が / へリダイレクトする。
export function findQuestionSet(id: string): QuestionSet | undefined {
  return questionSets.find((set) => set.id === id);
}

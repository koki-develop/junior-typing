export type Question = {
  text: string;
  kana: string;
};

// 将来的に「テーマ別」「難易度別」などで複数セットを並べる想定の集約単位。
// id は URL (/play/$setId) に載る安定識別子で、UI 側の並び順や表示は title に依存させる。
export type QuestionSet = {
  id: string;
  title: string;
  questions: Question[];
};

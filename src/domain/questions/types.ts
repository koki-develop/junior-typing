export type Question = {
  text: string;
  kana: string;
};

// 将来的に「テーマ別」「難易度別」などで複数セットを並べる想定の集約単位。
// id は URL (/play/$setId) に載る安定識別子で、UI 側の並び順や表示は title に依存させる。
// category は categories.ts の CATEGORIES に定義された Category.id への参照。同じテーマで
// 難易度違いのセットを並べる場合などに category を揃えて grouping するための情報で、
// 現状は表示にはまだ使っていない（CATEGORIES.color も含めて未使用）。
// questionCount は実際に1プレイで出題する問題数。questions にはより多くのプール問題を持たせ、
// プレイ開始のたびに questions からランダムに questionCount 件を無作為抽出し、
// 順序もシャッフルする（src/domain/questions/select.ts の selectQuestions）。
// 契約: questionCount は 1 以上 questions.length 以下であること（questions.test.ts が保証する）。
// selectQuestions 自身はこの前提のランタイム防御を持たない。
export type QuestionSet = {
  id: string;
  title: string;
  category: string;
  questionCount: number;
  questions: Question[];
};

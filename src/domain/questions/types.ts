export type Question = {
  text: string;
  kana: string;
};

// 将来的に「テーマ別」「難易度別」などで複数セットを並べる想定の集約単位。
// id は URL (/play/$setId) に載る安定識別子で、UI 側の並び順や表示は title に依存させる。
// category は categories.ts の CATEGORIES に定義された Category.id への参照。
// トップページで同カテゴリのセットを 1 つのセクションに束ねるためのキーで、
// 見出しラベル・アクセントドットの色は Category 側（label / color）から引く。
// questionCount は実際に1プレイで出題する問題数。questions にはより多くのプール問題を持たせ、
// プレイ開始のたびに questions から questionCount 件を抽出する（src/domain/questions/select.ts の
// selectQuestions）。抽出と並び順の挙動は randomOrder で切り替える:
//   randomOrder=true  … プール全体をシャッフルしてから先頭 questionCount 件を切り出すことで、
//                       「どれを出題するか」と「どの順で出題するか」を同時に無作為化する。
//   randomOrder=false … questions の定義順のまま先頭 questionCount 件を返す。あいうえお順など
//                       出題順そのものが学習体験の一部になるセット（ひらがな入門）向け。
// 契約: questionCount は 1 以上 questions.length 以下であること（questions.test.ts が保証する）。
// selectQuestions 自身はこの前提のランタイム防御を持たない。
export type QuestionSet = {
  id: string;
  title: string;
  category: string;
  questionCount: number;
  randomOrder: boolean;
  questions: Question[];
};

export type Question = {
  text: string;
  // 出題の「かな」の読み方。1 個以上で、kanas[0] を「代表読み」として扱う:
  //   - ふりがな（漢字の上に表示するかな）の初期表示は kanas[0]
  //   - ローマ字ヒントの初期表示も kanas[0] のパターン
  // 複数指定した場合、タイピングエンジンは全読み方を並列に候補として持ち、
  // 打鍵と矛盾しないもの（＝アクティブトラック）だけを残していく。
  // 表示中のふりがな／ローマ字ヒントは常に「先頭のアクティブトラック」の読み方を映すため、
  // 代表読みが脱落した瞬間に次の生き残り読み方（kanas の次の候補）へ切り替わる。
  // 完了判定も同じく「先頭アクティブトラックが完了したら done」で統一する。
  // したがって kanas の並びは:
  //   - 先頭ほど「表示ヒントとして自然な読み」（一般的・代表的なもの）
  //   - 後ろほど「別読みとして受理は許すが、初期表示はしない」もの
  // が望ましい。prefix が重複する読み方を混ぜる場合（例 ["あ", "あん"]）は
  // 「短い方を先頭に置くと長い方が到達不能になる」ため、より長い / より一般的な
  // 読みを先頭に置くのがデータ規約。
  kanas: string[];
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

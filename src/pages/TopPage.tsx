import { Link } from "@tanstack/react-router";
import { CATEGORIES } from "../domain/questions/categories.ts";
import { previewWords } from "../domain/questions/preview.ts";
import { questionSets } from "../domain/questions/questions.ts";
import type { QuestionSet } from "../domain/questions/types.ts";

// トップページ。カテゴリ別に問題セットのカードを並べる「セレクタ」画面。
// - 並びの権威は CATEGORIES（表示順・色ドットの色）。questionSets の宣言順ではなく、
//   カテゴリ順に集約してから描画する。所属セットが無いカテゴリは丸ごと非表示。
// - カード内の要素は「セット名」と「サンプル語プレビュー」のみ。ハイスコアの領域は
//   まだ機能自体が無いので、下部の区切り線ごと省略している（実装時にこの下に足す想定）。
export function TopPage() {
  const groups = CATEGORIES.map((category) => ({
    category,
    sets: questionSets.filter((set) => set.category === category.id),
  })).filter((group) => group.sets.length > 0);

  return (
    <div className="min-h-screen bg-canvas font-round text-ink">
      <header className="border-b border-faint">
        <div className="mx-auto flex max-w-[1140px] items-center justify-between px-8 py-[22px]">
          <div className="flex items-center gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent"
            >
              <span className="text-2xl font-extrabold text-canvas">あ</span>
            </div>
            <h1 className="m-0 text-[22px] font-medium">ジュニアタイピング</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1140px] px-8 pt-11 pb-20">
        {groups.map(({ category, sets }) => (
          <section key={category.id} className="mb-11 last:mb-0">
            <div className="mb-[18px] flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-block h-[26px] w-[26px] rounded-[9px]"
                style={{ background: category.color }}
              />
              <h2 className="m-0 text-[22px] font-medium">{category.label}</h2>
            </div>
            <ul className="grid grid-cols-3 gap-5">
              {sets.map((set) => (
                <li key={set.id}>
                  <QuestionSetCard set={set} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}

// セットカード。カード全体が唯一のクリック対象。ホバーは枠色 + 淡い影のみで、
// アニメーション（transition/transform）は載せない（デザインの明示要件）。
function QuestionSetCard({ set }: { set: QuestionSet }) {
  return (
    <Link
      to="/play/$setId"
      params={{ setId: set.id }}
      className="block min-h-[104px] rounded-[18px] border border-faint bg-canvas p-[22px] hover:border-accent hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="text-[19px] leading-tight">{set.title}</div>
      <div className="mt-2 truncate text-[13px] font-bold text-muted">{previewWords(set)}</div>
    </Link>
  );
}

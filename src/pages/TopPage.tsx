import { Link } from "@tanstack/react-router";
import { questionSets } from "../domain/questions/questions.ts";

// トップページ。ゲームタイトルと問題セット選択リストを縦に並べる。
// 現時点ではセットは 1 つだけだが、UI としては「複数セットを並べる」前提の構造で作っておき、
// 将来 questionSets に追加されたセットが自然にカードとして増えるようにする。
export function TopPage() {
  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,1fr)] place-items-center bg-canvas px-6 py-16 font-round text-ink">
      <div className="grid w-full max-w-3xl place-items-center gap-16">
        <h1 className="text-center text-5xl font-medium tracking-tight md:text-6xl">
          ジュニアタイピング
        </h1>

        <section
          aria-labelledby="set-list-heading"
          className="grid w-full place-items-center gap-6"
        >
          <h2 id="set-list-heading" className="text-2xl tracking-[0.2em] text-muted">
            もんだいをえらんでね
          </h2>

          {/* セット数が増えても縦に自然に並ぶよう ul で並べる。1 枚のときは中央 1 列で違和感なし。 */}
          <ul className="grid w-full max-w-xl gap-4">
            {questionSets.map((set) => (
              <li key={set.id}>
                <QuestionSetCard id={set.id} title={set.title} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

// セットカード。カード全体を Link にすることでクリック可能領域を広げ、
// キーボード操作でも Tab → Enter で入れるようにする（focus-visible のリングも Link に載る）。
function QuestionSetCard({ id, title }: { id: string; title: string }) {
  return (
    <Link
      to="/play/$setId"
      params={{ setId: id }}
      className="block rounded-3xl border-2 border-faint bg-canvas px-8 py-6 text-center text-3xl font-medium text-ink transition hover:border-accent hover:bg-faint/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {title}
    </Link>
  );
}

import { Link } from "@tanstack/react-router";
import { isPerfectScore } from "../domain/game/score.ts";
import { CATEGORIES } from "../domain/questions/categories.ts";
import { previewWords } from "../domain/questions/preview.ts";
import { questionSets } from "../domain/questions/questions.ts";
import type { QuestionSet } from "../domain/questions/types.ts";
import { useHighScores } from "../features/highScores/useHighScores.ts";

// トップページ。カテゴリ別に問題セットのカードを並べる「セレクタ」画面。
// - 並びの権威は CATEGORIES（表示順・色ドットの色）。questionSets の宣言順ではなく、
//   カテゴリ順に集約してから描画する。所属セットが無いカテゴリは丸ごと非表示。
// - カード内の要素は「セット名」「サンプル語プレビュー」「区切り線 + ハイスコア」。
//   ハイスコアは useHighScores フック経由で受け取る（マウント時 snapshot / router の
//   remount 前提の詳細は useHighScores 内の JSDoc 参照）。
export function TopPage() {
  const groups = CATEGORIES.map((category) => ({
    category,
    sets: questionSets.filter((set) => set.category === category.id),
  })).filter((group) => group.sets.length > 0);

  const highScores = useHighScores();

  return (
    <div className="min-h-screen bg-canvas font-round text-ink">
      <header className="border-b border-faint">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-8 pt-8 pb-7">
          <div
            aria-hidden="true"
            className="flex h-15 w-15 shrink-0 items-center justify-center rounded-2xl bg-accent"
          >
            <span className="text-3xl font-extrabold leading-none text-canvas">あ</span>
          </div>
          <div className="min-w-0">
            <h1 className="m-0 text-3xl font-bold leading-none tracking-tight">
              ジュニアタイピング
            </h1>
            <p className="mt-2.5 text-sm text-muted">
              タイピングの きほんを、パソコンで まなぼう。
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 pt-12 pb-24">
        {groups.map(({ category, sets }) => (
          <section key={category.id} className="mb-12 last:mb-0">
            <div className="mb-5 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-block h-4.5 w-4.5 rounded-md"
                style={{ background: category.color }}
              />
              <h2 className="m-0 text-2xl font-bold leading-none tracking-tight">
                {category.label}
              </h2>
            </div>
            <ul className="grid grid-cols-3 gap-5">
              {sets.map((set) => (
                <li key={set.id}>
                  <QuestionSetCard set={set} highScore={highScores[set.id] ?? null} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}

// セットカード。カード全体が唯一のクリック対象。
//
// カードの見た目は 2 段階:
//   - 非パーフェクト (未プレイ / プレイ済み) : border border-faint
//   - パーフェクト (isPerfectScore)          : border-2 border-accent
// 未プレイとプレイ済みは枠を分けない（試行錯誤の結果、faint→muted/faded の枠色差は
// 主張が強すぎ or 弱すぎで良い塩梅が見つからなかった）。代わりに「値がまだ入っていない」
// ことはスコア行を全体的に薄く（text-faded）することで表現し、プレイ済みは値が数字 + ink
// で入るので視覚的に区別できる。
//
// hover は border 色でも box-shadow でも表さず、タイトルだけを accent に切り替える。
// - border-accent hover は perfect の枠と衝突するため使えない
// - box-shadow はカードのフラットな平面感を崩す（デザインの明示要件で禁止）
// group / group-hover:text-accent を title 要素直上に置くことで、hover の作用範囲を
// 「title 要素だけ」に明示的にロックする。以前は Link に hover:text-accent を掛け、
// 「明示 text-* を持たない子要素だけ accent になる」CSS 継承の副作用に依存していたが、
// - 誰かが title 要素に text-ink を付けると hover が silent に無効化
// - 誰かが他要素の text-* を落とすと hover 時にその要素まで silent に着色
// と両方向に静かに壊れる罠だった。group-hover を「反応させたい 1 要素」に直接付けることで
// 依存関係を明示化した。トランジションは付けない（カードのアニメーション制約に従う）。
//
// パーフェクト時はさらに、スコア値の左に "★" を付けて accent 色 + bold で強調する。
// 星は U+2605（テキスト記号）を使用。絵文字（👑/🏆 など）は OS ごとにカラー絵文字/モノクロが
// バラつくためパレットの一貫性を壊す。
//
// 値位置の "-" は未記録用のプレースホルダ。文（「まだ ないよ」等）ではなくダッシュに
// しているのは、カードを 3 列で並べたとき「数字（tabular-nums で幅固定）」と可変長の文が
// 混在するとカード内右端の位置がバラつき、視線の流れが乱れるため。未記録時のダッシュは
// text-faded に落として「値が入っていない状態」を色でも表現する。ラベル「ハイスコア」も
// 同じ text-faded に揃えて、スコア行全体を「無」のトーンで統一する。
//
// レイアウトは右寄せ。ただしラベル「ハイスコア」の位置はカードごとに揃えたいので、
// 値側に min-w-[6ch] の固定枠を与える。パーフェクト時の "★1000"（1 + 4 桁）の実幅は、
// font-mono + tabular-nums でも "★" が digit の 1ch 幅に揃う保証は無い（tabular-nums の
// 保証は digit 間だけ）。5ch だと "★1000" が枠を超えて label 位置を左に押す可能性がある
// ため、1ch 余裕を持たせて 6ch にする。数値のみ表示のカードでも枠幅は同じなので、実際の
// 値幅（1〜4 桁 / "-" / "★1000"）に関係なく枠の左端 = ラベルの右端が全カードで揃う。
// 枠内の揃えは数値なら右寄せ（桁の縦揃えを保つ）、未記録の "-" だけは中央寄せにして
// 右端に張り付いた寂しさを避ける。パーフェクトは "★1000" 全体を右寄せで扱う。
//
// カード内の区切り線は全状態で border-faint のまま。カード枠が accent に変わっても、
// 内側の水平線まで accent にすると視覚的に強すぎる（オレンジの横線がカード内で目立つ）。
//
// aria-label を set.title に明示指定しているのは、Link 配下に置いた「ハイスコア XXX」の
// テキストがそのままアクセシブル名に連結されると読み上げが冗長になるため。カード全体の
// 役割はあくまで「セットに入るリンク」なので、その名前はセットのタイトルに絞る。
function QuestionSetCard({ set, highScore }: { set: QuestionSet; highScore: number | null }) {
  const isPerfect = highScore !== null && isPerfectScore(highScore);
  const isPlayed = highScore !== null;

  // 状態を 1 か所で分岐して className の重複を避ける。
  // - borderClass: パーフェクトのみ border-2 border-accent。それ以外は border-faint（1px）。
  //   border-2 は box-sizing: border-box 前提で外形は変わらず、内側パディングだけが
  //   1px 縮む（p-5.5 = 22px に対して不可視レベル）。
  // - labelClass: 未記録のときはラベルも text-faded に落として値と揃える。プレイ済み /
  //   パーフェクトは text-muted で通常のラベル色。
  // - valueClass: 値の色 + 揃え。未記録は中央 + faded、プレイ済みは右寄せ + ink、
  //   パーフェクトは右寄せ + accent + bold で祝う。
  const borderClass = isPerfect ? "border-2 border-accent" : "border border-faint";
  const labelClass = isPlayed ? "text-muted" : "text-faded";
  const valueClass = isPerfect
    ? "text-right font-bold text-accent"
    : isPlayed
      ? "text-right text-ink"
      : "text-center text-faded";

  return (
    <Link
      to="/play/$setId"
      params={{ setId: set.id }}
      aria-label={set.title}
      className={`group block min-h-27 rounded-2xl bg-canvas p-5.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${borderClass}`}
    >
      <div className="text-xl font-bold leading-tight tracking-tight group-hover:text-accent">
        {set.title}
      </div>
      <div className="mt-2 truncate text-sm text-muted">{previewWords(set)}</div>
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-faint pt-3 text-sm">
        <span className={labelClass}>ハイスコア</span>
        <span className={`min-w-[6ch] font-mono tabular-nums ${valueClass}`}>
          {isPerfect ? `★${highScore}` : isPlayed ? highScore : "-"}
        </span>
      </div>
    </Link>
  );
}

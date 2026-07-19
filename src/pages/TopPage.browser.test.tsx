import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { routeTree } from "../app/router.tsx";
import { MAX_SCORE } from "../domain/game/score.ts";
import { CATEGORIES } from "../domain/questions/categories.ts";
import { previewWords } from "../domain/questions/preview.ts";
import { questionSets } from "../domain/questions/questions.ts";
import { recordHighScore } from "../services/highScores.ts";

// TopPage は <Link> を持つのでルータコンテキスト必須。プロダクションと同じ routeTree を通す。
function renderTopPage() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

// ハイスコア表示テストで前後テストの localStorage 状態が混ざらないようにクリアする。
// ブラウザは実 localStorage を持つので、明示的に空にしないと同一プロジェクト内の
// 別テスト（例: PlayPage）が残した値でハイスコア表示テストが偽陽性/偽陰性になる。
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

test("ヘッダーにプロダクト名が h1 として表示される", async () => {
  const screen = await renderTopPage();

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "ジュニアタイピング" }))
    .toBeVisible();
});

test("所属セットが 1 つ以上あるカテゴリ見出しが表示される", async () => {
  const screen = await renderTopPage();

  // CATEGORIES を直接データソースにすることで、カテゴリ追加時にテストが自動追従する。
  // 現状 questionSets は全 CATEGORIES に少なくとも 1 セットずつ属している。
  for (const category of CATEGORIES) {
    await expect
      .element(screen.getByRole("heading", { level: 2, name: category.label }))
      .toBeVisible();
  }
});

test("questionSets の各セットがカード（リンク）として表示される", async () => {
  const screen = await renderTopPage();

  // questionSets を直接データソースにすることで、セット追加時にテストが自動追従する。
  // aria-label = set.title を厳密一致でヒットさせる（testing-library の name オプションは
  // 文字列だと default で exact: true = 完全一致 / 大小区別あり）。RegExp で set.title を
  // 動的にラップすると、将来のセット名が (), ., ?, + などの正規表現メタ文字を含んだ
  // 瞬間コンパイル/マッチの意味が壊れるし、substring 一致で兄弟セットに引っかかるリスクも
  // 残る（例: "きゃきゅきょ" を新設すると既存の "きゃきゅきょ・しゃしゅしょ・ちゃちゅちょ"
  // にも刺さって Found multiple elements になる）。
  for (const set of questionSets) {
    const link = screen.getByRole("link", { name: set.title });
    await expect.element(link).toBeVisible();
    // href に /play/$setId が展開されていることを確認する（Link の params プロパティの動作検証）。
    await expect.element(link).toHaveAttribute("href", `/play/${set.id}`);
  }
});

test("カードにサンプル語プレビューが表示される", async () => {
  const screen = await renderTopPage();

  // 各セットの previewWords 文字列が、そのセット自身のカード内に載っていることを確認する
  // （プレビュー実装の内部は追わず「中身が伝わる文字列が出ている」ことだけ検証）。
  // 先頭 1 問の text だけで検索するとタイトルとプレビューの両方にヒットするセット
  // （例: ひらがな系はタイトルにも「あ」が含まれる）で多重マッチになるため、
  // プレビュー全体の文字列で検索してタイトル要素と衝突しないようにする。
  for (const set of questionSets) {
    const card = screen.getByRole("link", { name: set.title });
    await expect.element(card.getByText(previewWords(set))).toBeVisible();
  }
});

test("未プレイのセットは border-faint の枠と、値位置に薄い '-' が表示される", async () => {
  const screen = await renderTopPage();

  // localStorage は beforeEach でクリア済みなので全セットが未プレイ状態。
  // 3 状態の階段設計で「未プレイ」に割り当てているのが border-faint（最も薄い枠色）と "-"（faded 色）。
  // 全カードに対して同じ検証を回すことで、カテゴリ問わず初期状態が均質であることを担保する。
  for (const set of questionSets) {
    const card = screen.getByRole("link", { name: set.title });
    await expect.element(card).toHaveClass("border-faint");
    await expect.element(card.getByText("ハイスコア")).toBeVisible();
    await expect.element(card.getByText("-")).toBeVisible();
  }
});

test("プレイ済み (< 満点) のセットは枠は未プレイと同じで、スコア数値が入り、★ は付かない", async () => {
  // land-animals にだけ 800 を書き込んだ状態でレンダー。
  // 枠は未プレイと同じ border-faint（差を付けない設計）。値のみ "800" に変わる。
  // 未プレイと違って値が数字（text-ink）で入るので、"見た目に差が付く" のはスコア行だけ。
  recordHighScore("land-animals", 800);

  const screen = await renderTopPage();

  const targetCard = screen.getByRole("link", { name: "どうぶつ" });
  await expect.element(targetCard).toHaveClass("border-faint");
  await expect.element(targetCard.getByText("ハイスコア")).toBeVisible();
  await expect.element(targetCard.getByText("800")).toBeVisible();

  // 他セットは未プレイのまま（枠は同じ border-faint、値は "-"）。
  const otherCard = screen.getByRole("link", { name: "うみのいきもの" });
  await expect.element(otherCard).toHaveClass("border-faint");
  await expect.element(otherCard.getByText("-")).toBeVisible();
});

test("未プレイのラベルと値は同じ薄さ (text-faded)、プレイ済みのラベルは text-muted に戻る", async () => {
  // 未プレイの表示は「値だけでなくラベルも一緒に薄くする」ことで、スコア行全体で
  // 「まだ何もない」を表現する。プレイ済みのカードではラベルは text-muted に戻る。
  // テストの主張は「ラベル = 値の薄さ (未プレイ時)」なので、value 側にも
  // .toHaveClass("text-faded") を掛けて invariant を lock する（label だけを検証すると
  // 未プレイの値だけ別色に化けても検出できない）。
  recordHighScore("land-animals", 800);

  const screen = await renderTopPage();

  // 未プレイセット: ラベルも値もどちらも text-faded で揃う
  const otherCard = screen.getByRole("link", { name: "うみのいきもの" });
  await expect.element(otherCard.getByText("ハイスコア")).toHaveClass("text-faded");
  await expect.element(otherCard.getByText("-")).toHaveClass("text-faded");

  // プレイ済みセット: ラベルは text-muted（通常）に戻る
  const targetCard = screen.getByRole("link", { name: "どうぶつ" });
  await expect.element(targetCard.getByText("ハイスコア")).toHaveClass("text-muted");
});

test("パーフェクト (満点) のセットは 2px の border-accent 枠と '★<満点>' 表示になる", async () => {
  // land-animals に満点を書き込む。3 状態の最上段。
  // - 枠が 2px の border-accent（オレンジ）に昇格（border-2 クラスが付く）
  // - 値が "★1000" 形式で、★ + 満点数値が同じ span に入る（星もスコアと同色トーンで統一される）
  recordHighScore("land-animals", MAX_SCORE);

  const screen = await renderTopPage();

  const targetCard = screen.getByRole("link", { name: "どうぶつ" });
  await expect.element(targetCard).toHaveClass("border-2");
  await expect.element(targetCard).toHaveClass("border-accent");
  await expect.element(targetCard.getByText("ハイスコア")).toBeVisible();
  await expect.element(targetCard.getByText(`★${MAX_SCORE}`)).toBeVisible();
});

test("hover は group / group-hover:text-accent 構造で title 要素だけを accent 化する", async () => {
  // hover 挙動の invariant を「Link に group クラス」「title 要素に group-hover:text-accent」の
  // 2 点で lock する。以前は Link 側の hover:text-accent + CSS 継承に頼っていたが、
  // その方式は「明示 text-* を持たない子要素だけ accent」という silent な依存で、
  // 誰かが title に text-ink を足す or 他要素の text-* を落とすと片方向 or 両方向に静かに壊れる。
  // ここでは実際の :hover 状態の色までは検証せず（Playwright での flakiness を避ける）、
  // 構造の存在だけを検証する。構造が保たれる限り Tailwind の group-hover 変種が
  // 期待通り動作することは Tailwind 側で保証される。
  const screen = await renderTopPage();

  const card = screen.getByRole("link", { name: "どうぶつ" });
  await expect.element(card).toHaveClass("group");
  await expect.element(card.getByText("どうぶつ")).toHaveClass("group-hover:text-accent");
});

test("カードには press=press の cuelume 属性が付く", async () => {
  const screen = await renderTopPage();

  // 実際の再生確認は services/sound.test.ts（cuelume を mock した unit テスト）で行う。
  // ここでは cuelume の bind() が拾う data 属性がカード（Link）に正しく載っていることだけを
  // 構造として lock する。hover 側（data-cuelume-hover）はうるさかったため見送っており、
  // 意図的に付けていない。
  for (const set of questionSets) {
    const card = screen.getByRole("link", { name: set.title });
    await expect.element(card).toHaveAttribute("data-cuelume-press", "press");
    await expect.element(card).not.toHaveAttribute("data-cuelume-hover");
  }
});

test("カードのアクセシブル名はセットタイトルのみで、ハイスコア値は含めない", async () => {
  // Link 配下にハイスコアテキストを置くと、accessible name の自動連結で
  // 読み上げが「セット名 サンプル語 ハイスコア 800」のように冗長になる。
  // aria-label でセットタイトルに絞る実装意図をロックするテスト。
  recordHighScore("land-animals", 800);

  const screen = await renderTopPage();

  const card = screen.getByRole("link", { name: "どうぶつ" });
  await expect.element(card).toBeVisible();
});

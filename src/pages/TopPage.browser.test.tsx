import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { routeTree } from "../app/router.ts";
import { CATEGORIES } from "../domain/questions/categories.ts";
import { questionSets } from "../domain/questions/questions.ts";

// TopPage は <Link> を持つのでルータコンテキスト必須。プロダクションと同じ routeTree を通す。
function renderTopPage() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

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
  for (const set of questionSets) {
    const link = screen.getByRole("link", { name: new RegExp(set.title) });
    await expect.element(link).toBeVisible();
    // href に /play/$setId が展開されていることを確認する（Link の params プロパティの動作検証）。
    await expect.element(link).toHaveAttribute("href", `/play/${set.id}`);
  }
});

test("カードにサンプル語プレビューが表示される", async () => {
  const screen = await renderTopPage();

  // 各セットの先頭の問題テキストが画面のどこかに載っていることを確認する
  // （プレビュー実装の内部は追わず「中身が伝わる語が出ている」ことだけ検証）。
  // セット間で text が重複するものは検証対象から外し、getByText の一意性を担保する。
  const seen = new Set<string>();
  for (const set of questionSets) {
    const firstText = set.questions[0].text;
    if (seen.has(firstText)) continue;
    seen.add(firstText);
    await expect.element(screen.getByText(firstText, { exact: false })).toBeVisible();
  }
});

import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "../app/router.ts";
import { questionSets } from "../domain/questions/questions.ts";

// TopPage は <Link> を持つのでルータコンテキスト必須。プロダクションと同じ routeTree を通す。
function renderTopPage() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

test("ゲームタイトルが h1 として表示される", async () => {
  const screen = await renderTopPage();

  await expect.element(screen.getByRole("heading", { name: "ジュニアタイピング" })).toBeVisible();
});

test("問題セット選択見出しが表示される", async () => {
  const screen = await renderTopPage();

  await expect.element(screen.getByRole("heading", { name: "もんだいをえらんでね" })).toBeVisible();
});

test("questionSets の各セットがカード（リンク）として表示される", async () => {
  const screen = await renderTopPage();

  // questionSets を直接データソースにすることで、セット追加時にテストが自動追従する。
  for (const set of questionSets) {
    const link = screen.getByRole("link", { name: set.title });
    await expect.element(link).toBeVisible();
    // href に /play/$setId が展開されていることを確認する（Link の params プロパティの動作検証）。
    await expect.element(link).toHaveAttribute("href", `/play/${set.id}`);
  }
});

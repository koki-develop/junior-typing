import { render } from "vitest-browser-react";
import { expect, test, vi } from "vitest";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";

// PlayPage → useTypingGame → services/sound.ts 経由で cuelume が読み込まれる。
// 本テストは routeTree のパス解決だけを確かめる目的なので、実 play を空にしておく。
vi.mock("cuelume", () => ({ play: vi.fn() }));

import { routeTree } from "./router.ts";

// createBrowserHistory は Playwright 上の実 URL に依存するため、テストは常に
// memory history でパスを初期エントリにする（プロダクションと同じ routeTree を通す）。
function createTestRouter(initialPath: string) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

test("`/` ルートは TopPage を描画する（タイトルが表示される）", async () => {
  const router = createTestRouter("/");
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(screen.getByRole("heading", { name: "ジュニアタイピング" })).toBeVisible();
});

test("`/play/sample` は PlayPage を描画する（IdleMessage が表示される）", async () => {
  const router = createTestRouter("/play/sample");
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(screen.getByText("スタート")).toBeVisible();
});

test("存在しない setId (`/play/unknown`) は / にリダイレクトされ TopPage が表示される", async () => {
  const router = createTestRouter("/play/unknown");
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(screen.getByRole("heading", { name: "ジュニアタイピング" })).toBeVisible();
});

import { render } from "vitest-browser-react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";

// PlayPage → useTypingGame → services/sound.ts 経由で cuelume が読み込まれる。
// 本テストは routeTree のパス解決だけを確かめる目的なので、実 play/bind を空にしておく。
vi.mock("cuelume", () => ({ play: vi.fn(), bind: vi.fn() }));

import { SITE_DESCRIPTION, SITE_TITLE, TOP_TITLE } from "./meta.ts";
import { routeTree } from "./router.tsx";
import { COUNTDOWN_STEP_MS } from "../domain/game/machine.ts";
import { findQuestionSet } from "../domain/questions/questions.ts";
import { advanceTimers, pressKey, runInAct } from "../test/browser-helpers.ts";

// head で差し込んだ <title>/<meta name="description"> は React 19 の自動 hoisting で
// document.head に反映される。route 解決（beforeLoad → head）が render 後に非同期で走るため、
// document.title の反映を expect.poll で待つ。
function descriptionContent() {
  return document.querySelector('meta[name="description"]')?.getAttribute("content");
}

// createBrowserHistory は Playwright 上の実 URL に依存するため、テストは常に
// memory history でパスを初期エントリにする（プロダクションと同じ routeTree を通す）。
function createTestRouter(initialPath: string) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

beforeEach(() => {
  // MessageChannel など React のスケジューラが使う API は fake 化しない。
  // setTimeout/clearTimeout だけを fake にすることで、schedule effect のタイマーだけを制御する。
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

test("`/` ルートは TopPage を描画する（タイトルが表示される）", async () => {
  const router = createTestRouter("/");
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(screen.getByRole("heading", { name: "ジュニアタイピング" })).toBeVisible();
});

test("`/` ルートは document の title/description に TOP_TITLE/SITE_DESCRIPTION を反映する", async () => {
  const router = createTestRouter("/");
  await render(<RouterProvider router={router} />);

  await expect.poll(() => document.title).toBe(TOP_TITLE);
  await expect.poll(descriptionContent).toBe(SITE_DESCRIPTION);
});

const landAnimalsSet = findQuestionSet("land-animals");
if (!landAnimalsSet) throw new Error("test fixture missing: questionSets に 'land-animals' がない");
const mealsSet = findQuestionSet("meals");
if (!mealsSet) throw new Error("test fixture missing: questionSets に 'meals' がない");

test("`/play/land-animals` は PlayPage を描画する（IdleMessage が表示される）", async () => {
  const router = createTestRouter("/play/land-animals");
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(screen.getByText(landAnimalsSet.title)).toBeVisible();
});

test("`/play/land-animals` は document の title をセット名で上書きし、description は共通のまま", async () => {
  const router = createTestRouter("/play/land-animals");
  await render(<RouterProvider router={router} />);

  await expect.poll(() => document.title).toBe(`${landAnimalsSet.title} | ${SITE_TITLE}`);
  await expect.poll(descriptionContent).toBe(SITE_DESCRIPTION);
});

test("存在しない setId (`/play/unknown`) は / にリダイレクトされ TopPage が表示される", async () => {
  const router = createTestRouter("/play/unknown");
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(screen.getByRole("heading", { name: "ジュニアタイピング" })).toBeVisible();
});

test("setId が変わると PlayPage が丸ごとマウントし直され、直前のプレイ状態を引きずらない", async () => {
  // playRoute の remountDeps: ({ params }) => params が、setId の変化を PlayPage の
  // 完全な再マウントとして扱っていることを確かめる。これが無いと、プレイ中に setId が
  // 切り替わった場合に activeQuestions や useTypingGame の GameState が前のセットのデータを
  // 引きずったまま残ってしまう。
  const router = createTestRouter("/play/land-animals");
  const screen = await render(<RouterProvider router={router} />);

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  // countdown を終えて playing まで進めた状態（idle ではない）で別セットへ遷移する。
  await runInAct(() => router.navigate({ to: "/play/$setId", params: { setId: "meals" } }));
  // 再マウントされた Keyboard の ResizeObserver 初回計測は act の外で非同期に発火するので、
  // 1 tick 分 flush してから読む（PlayPage.browser.test.tsx の同種コメント参照）。
  await advanceTimers(0);

  // 再マウントされた PlayPage は新しい GameState（idle）から始まるので、
  // "playing" の続きではなく遷移後のセット名の案内が表示される。
  await expect.element(screen.getByText(mealsSet.title)).toBeVisible();
});

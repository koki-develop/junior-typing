import { render } from "vitest-browser-react";
import { expect, test, vi } from "vitest";
import type { GameResult } from "../../../domain/game/score.ts";
import { ResultScreen } from "./ResultScreen.tsx";

const sampleResult: GameResult = {
  correctKeys: 40,
  wrongKeys: 3,
  totalKeys: 43,
  elapsedMs: 12_400,
  score: 375,
};

test("スコア・打鍵数・ミス数・かかった時間・ボタンをすべて描画する", async () => {
  const screen = await render(<ResultScreen result={sampleResult} onRestart={() => {}} />);

  await expect.element(screen.getByText("スコア")).toBeVisible();
  await expect.element(screen.getByLabelText("スコア 375")).toBeVisible();
  // 数値は他のラベル値と衝突するので dt/dd ペアのラベル経由でヒットさせる。
  await expect.element(screen.getByText("うったキー")).toBeVisible();
  await expect.element(screen.getByRole("definition").filter({ hasText: /^43$/ })).toBeVisible();
  await expect.element(screen.getByText("まちがえたキー")).toBeVisible();
  await expect.element(screen.getByRole("definition").filter({ hasText: /^3$/ })).toBeVisible();
  await expect.element(screen.getByText("かかったじかん")).toBeVisible();
  // かかったじかんの dd は数字（"12.4"）と単位（"びょう"）を別要素にして右端揃えを実現するため、
  // 単一 text ノードでは "12.4びょう" を持たない。dd の textContent で確認する。
  await expect
    .element(screen.getByRole("definition").filter({ hasText: "12.4びょう" }))
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "もういちど" })).toBeVisible();
  await expect.element(screen.getByText("スペースキーでもう1回")).toBeVisible();
});

test("経過時間は 1 秒未満でも 0.X びょうで表示される", async () => {
  const screen = await render(
    <ResultScreen result={{ ...sampleResult, elapsedMs: 800 }} onRestart={() => {}} />,
  );

  await expect
    .element(screen.getByRole("definition").filter({ hasText: "0.8びょう" }))
    .toBeVisible();
});

test("「もういちど」ボタンをクリックすると onRestart が呼ばれる", async () => {
  const onRestart = vi.fn();
  const screen = await render(<ResultScreen result={sampleResult} onRestart={onRestart} />);

  await screen.getByRole("button", { name: "もういちど" }).click();

  expect(onRestart).toHaveBeenCalledTimes(1);
});

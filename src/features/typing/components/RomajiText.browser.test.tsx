import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { RomajiText } from "./RomajiText.tsx";

// typed / next / rest はそれぞれ役割の違う span で描かれるが、
// role や aria を持たないため、テストは「テキストとして 3 パーツが揃うこと」と
// 「next のときだけ NextChar 用の余分な span が挟まること」を検証する。

test("typed / next / rest を順に連結して描画する", async () => {
  const screen = await render(<RomajiText typed="ka" next="k" rest="i" />);

  await expect.element(screen.getByText("ka", { exact: true })).toBeInTheDocument();
  await expect.element(screen.getByText("k", { exact: true })).toBeInTheDocument();
  await expect.element(screen.getByText("i", { exact: true })).toBeInTheDocument();
});

test("next が空文字なら NextChar span は描画されない", async () => {
  const screen = await render(<RomajiText typed="ka" next="" rest="ki" />);

  // typed + rest の 2 パーツだけになるはず。
  expect(screen.container.querySelectorAll("p > span")).toHaveLength(2);
});

test("next があるときは NextChar span が 1 つ挟まる", async () => {
  const screen = await render(<RomajiText typed="ka" next="k" rest="i" />);

  expect(screen.container.querySelectorAll("p > span")).toHaveLength(3);
});

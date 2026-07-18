import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { PhaseLayout } from "./PhaseLayout.tsx";

// top/bottom は省略時に invisible + aria-hidden のプレースホルダへ差し替わるが、
// main は必須 prop なので常にそのまま描画される。この非対称性が高さ揃えの要なので、
// 3 段それぞれの挙動を分けて検証する。

test("top と bottom を渡すとそれぞれの内容を描画する", async () => {
  const screen = await render(
    <PhaseLayout top="ふりがな" main={<span>見出し</span>} bottom="ローマ字" />,
  );

  await expect.element(screen.getByText("ふりがな")).toBeVisible();
  await expect.element(screen.getByText("見出し")).toBeVisible();
  await expect.element(screen.getByText("ローマ字")).toBeVisible();
});

test("top 省略時はふりがな段が invisible + aria-hidden のプレースホルダになる", async () => {
  const screen = await render(<PhaseLayout main={<span>見出し</span>} bottom="ローマ字" />);

  const topRow = screen.container.querySelector("p");
  expect(topRow).not.toBeNull();
  expect(topRow?.classList.contains("invisible")).toBe(true);
  expect(topRow?.getAttribute("aria-hidden")).toBe("true");
});

test("bottom 省略時はローマ字段が invisible + aria-hidden のプレースホルダになる", async () => {
  const screen = await render(<PhaseLayout top="ふりがな" main={<span>見出し</span>} />);

  // ローマ字段は mt-4 を持つ div で、見出し段（leading-none）と区別できる。
  const bottomRow = screen.container.querySelector(".mt-4");
  expect(bottomRow).not.toBeNull();
  expect(bottomRow?.classList.contains("invisible")).toBe(true);
  expect(bottomRow?.getAttribute("aria-hidden")).toBe("true");
});

test("main 段は top/bottom の有無に関わらずそのまま描画され、invisible プレースホルダ化されない", async () => {
  const screen = await render(<PhaseLayout main={<span>中身</span>} />);

  await expect.element(screen.getByText("中身")).toBeVisible();

  // 見出し段は leading-none で他の 2 段と区別できる。main は必須 prop なので
  // top/bottom のような invisible 分岐を持たない。
  const mainRow = screen.container.querySelector(".leading-none");
  expect(mainRow).not.toBeNull();
  expect(mainRow?.classList.contains("invisible")).toBe(false);
  expect(mainRow?.hasAttribute("aria-hidden")).toBe(false);
});

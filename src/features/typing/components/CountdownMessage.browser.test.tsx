import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { CountdownMessage } from "./CountdownMessage.tsx";

// PhaseLayout の共有分（見出し段の高さ揃えなど）は PhaseLayout.browser.test.tsx で検証するので、
// ここでは CountdownMessage 固有の関心（数字の表示・二重読み上げ防止・key によるリマウント）に絞る。

test("count=3 を可視テキストとして描画する", async () => {
  const screen = await render(<CountdownMessage count={3} />);
  await expect.element(screen.getByText("3")).toBeVisible();
});

test("count=2 を可視テキストとして描画する", async () => {
  const screen = await render(<CountdownMessage count={2} />);
  await expect.element(screen.getByText("2")).toBeVisible();
});

test("count=1 を可視テキストとして描画する", async () => {
  const screen = await render(<CountdownMessage count={1} />);
  await expect.element(screen.getByText("1")).toBeVisible();
});

test("数字の span は aria-hidden で、読み上げは TypingScreen 側の live 領域に一本化する", async () => {
  const screen = await render(<CountdownMessage count={3} />);

  const number = screen.container.querySelector(".animate-countdown-pop");
  expect(number).not.toBeNull();
  expect(number?.getAttribute("aria-hidden")).toBe("true");
});

test("ふりがな段・ローマ字段は invisible プレースホルダで高さだけ確保する", async () => {
  const screen = await render(<CountdownMessage count={3} />);

  // PhaseLayout は top/bottom 未指定時に invisible + aria-hidden の 2 段を描く。
  const placeholders = screen.container.querySelectorAll(".invisible");
  expect(placeholders).toHaveLength(2);
  for (const placeholder of placeholders) {
    expect(placeholder.getAttribute("aria-hidden")).toBe("true");
  }
});

test("count が変わると key={count} により数字の span が再マウントされる", async () => {
  const screen = await render(<CountdownMessage count={3} />);
  const before = screen.container.querySelector(".animate-countdown-pop");

  await screen.rerender(<CountdownMessage count={2} />);
  const after = screen.container.querySelector(".animate-countdown-pop");

  expect(after).not.toBe(before);
  expect(before?.isConnected).toBe(false);
});

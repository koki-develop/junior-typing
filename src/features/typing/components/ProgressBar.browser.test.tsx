import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { ProgressBar } from "./ProgressBar.tsx";

// ProgressBar は progressbar ロール + aria-valuemax / aria-valuenow を持つ。
// 「セグメントの並び」自体は装飾（<span>）なのでロールから直接引かず、
// aria-current="step" が現在位置のセグメントに 1 つだけ立つことを確認する。
test("aria 値と総セグメント数を props から素直に反映する", async () => {
  const screen = await render(<ProgressBar total={5} currentIndex={2} />);

  const bar = screen.getByRole("progressbar", { name: "タイピング進捗" });
  await expect.element(bar).toHaveAttribute("aria-valuemin", "0");
  await expect.element(bar).toHaveAttribute("aria-valuemax", "5");
  await expect.element(bar).toHaveAttribute("aria-valuenow", "2");
});

test("aria-valuenow は total を超えないように clamp する", async () => {
  const screen = await render(<ProgressBar total={5} currentIndex={99} />);

  const bar = screen.getByRole("progressbar", { name: "タイピング進捗" });
  await expect.element(bar).toHaveAttribute("aria-valuenow", "5");
});

test("current 位置のセグメントだけが aria-current='step' を持つ", async () => {
  const screen = await render(<ProgressBar total={4} currentIndex={1} />);

  const currents = screen.container.querySelectorAll("[aria-current='step']");
  expect(currents).toHaveLength(1);
});

test("total=0 のときは progressbar だけあってセグメントは 0 個", async () => {
  const screen = await render(<ProgressBar total={0} currentIndex={0} />);

  const bar = screen.getByRole("progressbar", { name: "タイピング進捗" });
  await expect.element(bar).toBeInTheDocument();
  expect(screen.container.querySelectorAll("span")).toHaveLength(0);
});

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

// idle / countdown のようにまだ 1 問目に入っていないフェーズでは currentIndex に null を渡し、
// どのセグメントも aria-current="step" を持たず、aria-valuenow は 0 のままにする。
test("currentIndex=null のときは aria-current='step' を持つセグメントは無い", async () => {
  const screen = await render(<ProgressBar total={5} currentIndex={null} />);

  const bar = screen.getByRole("progressbar", { name: "タイピング進捗" });
  await expect.element(bar).toHaveAttribute("aria-valuenow", "0");
  expect(screen.container.querySelectorAll("[aria-current='step']")).toHaveLength(0);
});

// filling=true のとき、現在セグメントは器（bg-faint + shadow）の中に accent の
// フィル子要素を持ち、animate-progress-fill クラスで scaleX(0→1) が走る。
// current との違いは「子要素が居るかどうか」だけで、外側の aria-current='step' は保つ。
test("filling=true のとき現在セグメントに fill アニメの子要素が入る", async () => {
  const screen = await render(<ProgressBar total={3} currentIndex={1} filling={true} />);

  const currents = screen.container.querySelectorAll("[aria-current='step']");
  expect(currents).toHaveLength(1);
  const fill = currents[0].querySelector(".animate-progress-fill");
  expect(fill).not.toBeNull();
  expect(fill?.classList.contains("bg-accent")).toBe(true);
});

// filling=false（既定）のときは current セグメントに子要素が入らず、
// 器だけが aria-current='step' を持つ「空の見た目」で止まる。
test("filling=false のとき現在セグメントに fill 子要素は無い", async () => {
  const screen = await render(<ProgressBar total={3} currentIndex={1} />);

  const currents = screen.container.querySelectorAll("[aria-current='step']");
  expect(currents).toHaveLength(1);
  expect(currents[0].querySelector(".animate-progress-fill")).toBeNull();
});

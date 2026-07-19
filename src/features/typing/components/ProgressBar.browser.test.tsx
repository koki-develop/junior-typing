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

// filling=true のとき、現在セグメントは pill の中に accent の fill 子要素を持ち、
// animate-progress-fill クラスで scaleX(0→1) が走る。current との違いは
// 「fill 子要素が居るかどうか」と「パルスが止まるかどうか」。外側の aria-current='step' は保つ。
test("filling=true のとき現在セグメントに fill アニメの子要素が入り、パルスは止まる", async () => {
  const screen = await render(<ProgressBar total={3} currentIndex={1} filling={true} />);

  const currents = screen.container.querySelectorAll("[aria-current='step']");
  expect(currents).toHaveLength(1);
  const fill = currents[0].querySelector(".animate-progress-fill");
  expect(fill).not.toBeNull();
  expect(fill?.classList.contains("bg-accent")).toBe(true);
  // filling 中は fill アニメが主役なのでパルスは掛けない。
  expect(currents[0].querySelector(".animate-progress-pulse")).toBeNull();
});

// filling=false（既定）のときは pill に fill 子要素は入らず、
// 代わりに常時パルス（opacity 1↔0.72）が走る「アクティブ待機」の見た目になる。
test("filling=false のとき現在セグメントは fill 子要素を持たずパルスが走る", async () => {
  const screen = await render(<ProgressBar total={3} currentIndex={1} />);

  const currents = screen.container.querySelectorAll("[aria-current='step']");
  expect(currents).toHaveLength(1);
  expect(currents[0].querySelector(".animate-progress-fill")).toBeNull();
  expect(currents[0].querySelector(".animate-progress-pulse")).not.toBeNull();
});

// current / filling いずれのアクティブ状態でも、pill の真上に「ここに居る」を示す▼マーカーを
// SVG で載せる。マーカーは装飾なので aria-hidden、色や動きに頼らず形で現在位置を伝える。
test("アクティブなセグメントの真上に▼マーカーが載る", async () => {
  const currentScreen = await render(<ProgressBar total={3} currentIndex={1} />);
  const currentActive = currentScreen.container.querySelector("[aria-current='step']");
  expect(currentActive?.querySelector("svg[aria-hidden='true']")).not.toBeNull();

  const fillingScreen = await render(<ProgressBar total={3} currentIndex={1} filling={true} />);
  const fillingActive = fillingScreen.container.querySelector("[aria-current='step']");
  expect(fillingActive?.querySelector("svg[aria-hidden='true']")).not.toBeNull();
});

// マーカーは「現在」のセグメントにだけ載る。remaining / done には出ない。
test("remaining / done のセグメントには▼マーカーは載らない", async () => {
  const screen = await render(<ProgressBar total={4} currentIndex={2} />);

  // currentIndex=2 なので [0, 1] が done、[2] が current、[3] が remaining。
  // SVG は current の 1 個だけ。
  expect(screen.container.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(1);
});

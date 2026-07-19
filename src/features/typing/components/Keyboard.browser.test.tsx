import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { Keyboard } from "./Keyboard.tsx";

// KeyCap は本来 aria-hidden の装飾なので、テストはロールでなく
// 見た目の状態（bg-accent クラスの有無）で「どのキーが強調されているか」を確認する。
// active な KeyCap は他と違う色（accent 塗り）になる仕様なので、
// bg-accent を持つノードが 1 つで、その中身が activeKey を大文字化したものであることを検証する。

test("activeKey に対応する KeyCap 1 つだけを強調する", async () => {
  const screen = await render(<Keyboard activeKey="f" />);

  const highlighted = screen.container.querySelectorAll(".bg-accent");
  expect(highlighted).toHaveLength(1);
  expect(highlighted[0].textContent).toBe("F");
});

test("activeKey が space のときは Space キーだけが強調される", async () => {
  const screen = await render(<Keyboard activeKey="space" />);

  const highlighted = screen.container.querySelectorAll(".bg-accent");
  expect(highlighted).toHaveLength(1);
  expect(highlighted[0].textContent).toBe("");
});

test("activeKey が null のときはどれも強調されない", async () => {
  const screen = await render(<Keyboard activeKey={null} />);

  expect(screen.container.querySelectorAll(".bg-accent")).toHaveLength(0);
});

test("activeKey は大文字小文字を問わず判定される", async () => {
  const screen = await render(<Keyboard activeKey="J" />);

  const highlighted = screen.container.querySelectorAll(".bg-accent");
  expect(highlighted).toHaveLength(1);
  expect(highlighted[0].textContent).toBe("J");
});

// JIS 配列全キー描画の検証。KeyCap には rounded-lg が付き、Enter や矢印セル（rounded のみ）
// には付かないため、rounded-lg で絞ると 5 段のアルファ／無地キーだけ取れる。

test("A-Z 26 個のアルファベットキーが大文字ラベルで表示される", async () => {
  const screen = await render(<Keyboard activeKey={null} />);

  const letters = Array.from(screen.container.querySelectorAll(".rounded-lg"))
    .map((el) => el.textContent ?? "")
    .filter((t) => /^[A-Z]$/.test(t))
    .sort();
  expect(letters).toEqual("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
});

test("アルファベット以外のキー（数字・記号・修飾）は文字ラベルを持たず無地表示になる", async () => {
  const screen = await render(<Keyboard activeKey={null} />);

  const keyCaps = Array.from(screen.container.querySelectorAll(".rounded-lg"));
  // KeyCap 総数 = 数字段 14 + QWERTY 段 13 + ASDF 段 13 + ZXCV 段 13 + Space 段 8 = 61。
  // Enter（clip-path で L 字を成形する）と矢印セル（rounded のみで rounded-lg は持たない）は除外される。
  expect(keyCaps).toHaveLength(61);

  const nonAlpha = keyCaps.map((el) => el.textContent ?? "").filter((t) => !/^[A-Z]$/.test(t));
  // 61 - 26 = 35 個の非アルファキーは全て空文字（無地）。
  expect(nonAlpha).toHaveLength(35);
  expect(nonAlpha.every((t) => t === "")).toBe(true);
});

test("Enter キーは QWERTY 段と ASDF 段にまたがる L 字形状（clip-path）で描画される", async () => {
  const screen = await render(<Keyboard activeKey={null} />);

  // clip-path を持つ唯一の要素が Enter。JIS の L 字は他キーと角の丸みを揃えるため
  // SVG path() で成形しているので、path 指定と、行 2 段分（8px ギャップ込みで 104px）の高さを確認する。
  const enter = screen.container.querySelector<HTMLElement>("[style*='clip-path']");
  expect(enter).not.toBeNull();
  expect(enter?.style.clipPath).toContain("path");
  expect(enter?.style.height).toBe("104px");
});

test("矢印エリアは半キー高の 4 キー（← ↑ ↓ →）を逆 T 字に配置する", async () => {
  const screen = await render(<Keyboard activeKey={null} />);

  // 矢印キーは半キー高のため rounded-lg ではなく rounded で描画している。
  // 逆 T 字レイアウトで 4 個（← ↑ ↓ →）のはず。上段の左右は空セル（背景なしの純空 div）で数に含めない。
  const arrows = Array.from(screen.container.querySelectorAll(".rounded.bg-ink\\/5"));
  expect(arrows).toHaveLength(4);
});

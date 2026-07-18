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

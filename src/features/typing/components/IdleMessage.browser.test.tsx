import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { IdleMessage } from "./IdleMessage.tsx";

test("スタート見出しと開始方法のヒントを両方描画する", async () => {
  const screen = await render(<IdleMessage />);

  await expect.element(screen.getByText("スタート")).toBeInTheDocument();
  await expect.element(screen.getByText("スペースキーで開始")).toBeInTheDocument();
});

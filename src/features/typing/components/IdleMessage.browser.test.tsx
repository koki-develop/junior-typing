import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { IdleMessage } from "./IdleMessage.tsx";

test("問題セット名の見出しと開始方法のヒントを両方描画する", async () => {
  const screen = await render(<IdleMessage title="どうぶつ" />);

  await expect.element(screen.getByText("どうぶつ")).toBeInTheDocument();
  await expect.element(screen.getByText("スペースキーで開始")).toBeInTheDocument();
});

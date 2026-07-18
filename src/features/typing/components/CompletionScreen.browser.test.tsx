import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { CompletionScreen } from "./CompletionScreen.tsx";

test("クリアメッセージとねぎらいの一行を描画する", async () => {
  const screen = await render(<CompletionScreen />);

  await expect.element(screen.getByText("終了！")).toBeVisible();
  await expect.element(screen.getByText("おつかれさまでした")).toBeVisible();
});

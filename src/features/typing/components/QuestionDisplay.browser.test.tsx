import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import { QuestionDisplay } from "./QuestionDisplay.tsx";

// RomajiText 自体の分岐（typed/next/rest の span 構成）は RomajiText.browser.test.tsx が
// 検証済みなので、ここでは QuestionDisplay が kana/text/romaji を正しく橋渡しすることと、
// cleared による見出し色・丸（MaruStamp）の出し分けに絞る。

test("kana / text / ローマ字の typed・next・rest を描画する", async () => {
  const screen = await render(
    <QuestionDisplay kana="かき" text="柿" typed="ka" next="k" rest="i" cleared={false} />,
  );

  await expect.element(screen.getByText("かき")).toBeVisible();
  await expect.element(screen.getByText("柿")).toBeVisible();
  await expect.element(screen.getByText("ka", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("k", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("i", { exact: true })).toBeVisible();
});

test("cleared=false のとき見出しは text-ink で、丸（svg）は描画されない", async () => {
  const screen = await render(
    <QuestionDisplay kana="かき" text="柿" typed="" next="k" rest="aki" cleared={false} />,
  );

  const heading = screen.getByText("柿").element();
  expect(heading.className).toContain("text-ink");
  expect(heading.className).not.toContain("text-emerald-500");
  expect(screen.container.querySelector("svg")).toBeNull();
});

test("cleared=true のとき見出しは text-emerald-500 になり、丸（svg）が重なる", async () => {
  const screen = await render(
    <QuestionDisplay kana="かき" text="柿" typed="kaki" next="" rest="" cleared={true} />,
  );

  const heading = screen.getByText("柿").element();
  expect(heading.className).toContain("text-emerald-500");
  expect(heading.className).not.toContain("text-ink");

  const stamp = screen.container.querySelector("svg");
  expect(stamp).not.toBeNull();
  // React は bare な `aria-hidden` を "true" にシリアライズする。読み上げ抑止という契約を
  // 「存在するだけ」で満足させると `aria-hidden="false"` への退化を素通しするため、値まで固定する。
  expect(stamp?.getAttribute("aria-hidden")).toBe("true");
});

test("丸（svg）はクリックを奪わず装飾専用（pointer-events-none + aria-hidden）", async () => {
  const screen = await render(
    <QuestionDisplay kana="かき" text="柿" typed="kaki" next="" rest="" cleared={true} />,
  );

  const stamp = screen.container.querySelector("svg");
  expect(stamp?.classList.contains("pointer-events-none")).toBe(true);
  expect(stamp?.getAttribute("aria-hidden")).toBe("true");
});

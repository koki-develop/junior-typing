import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "vitest-browser-react";
import { beforeEach, expect, test, vi } from "vitest";
import { MAX_SCORE } from "../../../domain/game/score.ts";
import type { GameResult } from "../../../domain/game/score.ts";
import { fireConfetti } from "../../../services/confetti.ts";
import { ResultScreen } from "./ResultScreen.tsx";

vi.mock("../../../services/confetti.ts", () => ({ fireConfetti: vi.fn() }));

beforeEach(() => {
  vi.mocked(fireConfetti).mockClear();
});

// ResultScreen は「もどる」に @tanstack/react-router の Link を使うため、
// ルータコンテキストなしでは描画できない。ここではアプリ本体の routeTree（app/router.tsx）
// には依存せず、ResultScreen だけを "/" にマウントする最小のルータをテストごとに作る。
function renderResult(props: Parameters<typeof ResultScreen>[0]) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <ResultScreen {...props} />,
  });
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) });
  return render(<RouterProvider router={router} />);
}

// 40 打鍵中 3 ミス、12.4 秒でクリアした想定。
// accuracy = 700 * 40/43 ≈ 651.16
// actualKps = 40*1000/12400 ≈ 3.226 keys/sec → 目標 2.0 以上で速度満点 300
// score = round(651.16 + 300) = 951
const sampleResult: GameResult = {
  correctKeys: 40,
  wrongKeys: 3,
  totalKeys: 43,
  elapsedMs: 12_400,
  score: 951,
};

test("スコア・打鍵数・ミス数・かかった時間・ボタンをすべて描画する", async () => {
  const screen = await renderResult({
    result: sampleResult,
    highScoreInfo: null,
    onRestart: () => {},
  });

  await expect.element(screen.getByText("スコア")).toBeVisible();
  await expect.element(screen.getByLabelText("スコア 951")).toBeVisible();
  // 数値は他のラベル値と衝突するので dt/dd ペアのラベル経由でヒットさせる。
  await expect.element(screen.getByText("うったキー")).toBeVisible();
  await expect.element(screen.getByRole("definition").filter({ hasText: /^43$/ })).toBeVisible();
  await expect.element(screen.getByText("まちがえたキー")).toBeVisible();
  await expect.element(screen.getByRole("definition").filter({ hasText: /^3$/ })).toBeVisible();
  await expect.element(screen.getByText("かかったじかん")).toBeVisible();
  // かかったじかんの dd は数字（"12.4"）と単位（"びょう"）を別要素にして右端揃えを実現するため、
  // 単一 text ノードでは "12.4びょう" を持たない。dd の textContent で確認する。
  await expect
    .element(screen.getByRole("definition").filter({ hasText: "12.4びょう" }))
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "もういちど" })).toBeVisible();
  await expect.element(screen.getByRole("link", { name: "もどる" })).toBeVisible();
});

test("経過時間は 1 秒未満でも 0.X びょうで表示される", async () => {
  const screen = await renderResult({
    result: { ...sampleResult, elapsedMs: 800 },
    highScoreInfo: null,
    onRestart: () => {},
  });

  await expect
    .element(screen.getByRole("definition").filter({ hasText: "0.8びょう" }))
    .toBeVisible();
});

test("「もういちど」ボタンには press=press の cuelume 属性が付く", async () => {
  const screen = await renderResult({
    result: sampleResult,
    highScoreInfo: null,
    onRestart: () => {},
  });

  await expect
    .element(screen.getByRole("button", { name: "もういちど" }))
    .toHaveAttribute("data-cuelume-press", "press");
});

test("「もういちど」ボタンをクリックすると onRestart が呼ばれる", async () => {
  const onRestart = vi.fn();
  const screen = await renderResult({ result: sampleResult, highScoreInfo: null, onRestart });

  await screen.getByRole("button", { name: "もういちど" }).click();

  expect(onRestart).toHaveBeenCalledTimes(1);
});

test("「もどる」リンクは / を指し、press=press の cuelume 属性が付く", async () => {
  const screen = await renderResult({
    result: sampleResult,
    highScoreInfo: null,
    onRestart: () => {},
  });

  const link = screen.getByRole("link", { name: "もどる" });
  await expect.element(link).toHaveAttribute("href", "/");
  await expect.element(link).toHaveAttribute("data-cuelume-press", "press");
});

test("highScoreInfo=null のときはハイスコア関連の表示（バッジ・前回スコア）は出ない", async () => {
  const screen = await renderResult({
    result: sampleResult,
    highScoreInfo: null,
    onRestart: () => {},
  });

  // バッジ文言（更新時 / パーフェクト時）と、前回スコア行のラベル "ハイスコア"
  // のいずれもドキュメント上に存在しないこと。exact: true で leaf 要素の
  // textContent と厳密一致させて、他文字列の部分一致による偽陽性を避ける。
  await expect.element(screen.getByText("ハイスコア！", { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText("パーフェクト！", { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText("ハイスコア", { exact: true })).not.toBeInTheDocument();
});

test("highScoreInfo=null かつスコアが満点でも「パーフェクト！」バッジは出ない", async () => {
  // perfect 単独ではバッジを出さない不変条件(highScoreInfo が確定するまでは常に非表示)の回帰防止。
  const screen = await renderResult({
    result: { ...sampleResult, score: MAX_SCORE },
    highScoreInfo: null,
    onRestart: () => {},
  });

  await expect.element(screen.getByText("パーフェクト！", { exact: true })).not.toBeInTheDocument();
});

test("isNewHigh=true のときは「ハイスコア！」バッジを表示し、前回スコア行は出ない", async () => {
  const screen = await renderResult({
    result: sampleResult,
    highScoreInfo: { previousHigh: 800, isNewHigh: true },
    onRestart: () => {},
  });

  await expect.element(screen.getByText("ハイスコア！", { exact: true })).toBeVisible();
  // 未更新時のみ出す "ハイスコア 800" 行は出ない。参考行の値そのもの（800）が
  // DOM に存在しないことと、参考行のラベル "ハイスコア"（leaf 一致）が
  // 存在しないことで担保する。
  await expect.element(screen.getByText("800", { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText("ハイスコア", { exact: true })).not.toBeInTheDocument();
});

test("isNewHigh=true かつスコアが満点なら文言は「パーフェクト！」に切り替わる", async () => {
  const screen = await renderResult({
    result: { ...sampleResult, score: MAX_SCORE },
    highScoreInfo: { previousHigh: 951, isNewHigh: true },
    onRestart: () => {},
  });

  await expect.element(screen.getByText("パーフェクト！", { exact: true })).toBeVisible();
  // 通常バッジ側の文言は出ない。
  await expect.element(screen.getByText("ハイスコア！", { exact: true })).not.toBeInTheDocument();
});

test("isNewHigh=false のときは「ハイスコア N」の参考行を表示し、バッジは出ない", async () => {
  const screen = await renderResult({
    result: sampleResult,
    highScoreInfo: { previousHigh: 980, isNewHigh: false },
    onRestart: () => {},
  });

  // ラベル "ハイスコア" と数値 980 の両方が可視。ラベルと値を別 span に
  // 分けているので、それぞれ leaf の textContent と exact 一致する。
  await expect.element(screen.getByText("ハイスコア", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("980", { exact: true })).toBeVisible();
  // 更新時バッジは出ない。
  await expect.element(screen.getByText("ハイスコア！", { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText("パーフェクト！", { exact: true })).not.toBeInTheDocument();
});

test("isNewHigh=true かつスコアが満点なら confetti を発火する", async () => {
  await renderResult({
    result: { ...sampleResult, score: MAX_SCORE },
    highScoreInfo: { previousHigh: 951, isNewHigh: true },
    onRestart: () => {},
  });

  await vi.waitFor(() => expect(fireConfetti).toHaveBeenCalledTimes(1));
});

test("isNewHigh=true だが満点でなければ confetti を発火しない", async () => {
  const screen = await renderResult({
    result: sampleResult,
    highScoreInfo: { previousHigh: 800, isNewHigh: true },
    onRestart: () => {},
  });

  // 「ハイスコア！」バッジの登場は confetti 発火と同じ瞬間（AnimatedScoreValue の
  // onComplete）なので、バッジが見えた時点で発火判定はすでに確定している。
  await expect.element(screen.getByText("ハイスコア！", { exact: true })).toBeVisible();
  expect(fireConfetti).not.toHaveBeenCalled();
});

test("isNewHigh=false でも満点なら「パーフェクト！」バッジを表示し、前回スコア行は出ない", async () => {
  // 満点を維持したままのリプレイ（同点は更新しない仕様なので isNewHigh=false になる）。
  // 記録上は未更新でも、天井に張り付いている状態は "未達成" ではないので、
  // 参考行ではなくバッジで達成を伝える。
  const screen = await renderResult({
    result: { ...sampleResult, score: MAX_SCORE },
    highScoreInfo: { previousHigh: MAX_SCORE, isNewHigh: false },
    onRestart: () => {},
  });

  await expect.element(screen.getByText("パーフェクト！", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("ハイスコア！", { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText("ハイスコア", { exact: true })).not.toBeInTheDocument();
});

test("isNewHigh=false なら満点でも confetti を発火しない", async () => {
  // バッジは出る（上のテスト参照）が、confetti は新規達成時のみに絞る演出方針は変えない。
  const screen = await renderResult({
    result: { ...sampleResult, score: MAX_SCORE },
    highScoreInfo: { previousHigh: MAX_SCORE, isNewHigh: false },
    onRestart: () => {},
  });

  // パーフェクトバッジの登場は confetti 発火と同じ瞬間（AnimatedScoreValue の
  // onComplete）なので、バッジが見えた時点で発火判定はすでに確定している。
  await expect.element(screen.getByText("パーフェクト！", { exact: true })).toBeVisible();
  expect(fireConfetti).not.toHaveBeenCalled();
});

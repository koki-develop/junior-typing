import { render } from "vitest-browser-react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StrictMode } from "react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";

// cuelume を叩かず、effect の実行（play 呼び出し）だけを気にせずに全問プレイできるようにする。
vi.mock("cuelume", () => ({ play: vi.fn(), bind: vi.fn() }));

import { routeTree } from "../app/router.tsx";
import { CLEAR_DELAY_MS, COUNTDOWN_STEP_MS } from "../domain/game/machine.ts";
import { MAX_SCORE } from "../domain/game/score.ts";
import { findQuestionSet } from "../domain/questions/questions.ts";
import { selectQuestions } from "../domain/questions/select.ts";
import { buildPatterns } from "../domain/romaji/patterns.ts";
import { advanceTimers, pressKey } from "../test/browser-helpers.ts";

// テストは常に /play/land-animals で PlayPage をマウントする。PlayPage は useParams({ from: "/play/$setId" })
// を使うのでルータコンテキスト必須。プロダクションと同じ routeTree を memory history で回す。
function renderPlayPage() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/play/land-animals"] }),
  });
  return render(<RouterProvider router={router} />);
}

// main.tsx が <StrictMode> でラップしているのと同じ環境を再現するための version。
// Strict Mode 下では function コンポーネントが 2 回 render されるため、render 中に
// 副作用を持つ recordHighScore を呼ぶと 1 回目の書き込みが 2 回目の判定結果を反転
// させて "新記録なのにバッジが出ない" 事象が起きていた（PlayPage 側で
// evaluateHighScore + useEffect の分離に修正済み）。この関数はその回帰を捕まえる
// ために使う。
function renderPlayPageStrict() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/play/land-animals"] }),
  });
  return render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

const animalsSet = findQuestionSet("land-animals");
if (!animalsSet) throw new Error("test fixture missing: questionSets に 'land-animals' がない");
const animalsPool = animalsSet.questions;
const animalsQuestionCount = animalsSet.questionCount;
const animalsRandomOrder = animalsSet.randomOrder;

// 各モーラの先頭候補（buildPatterns の candidates[0]）だけを打てば必ず正解になる。
// 「ん」「っ」は次モーラ次第で候補が変わるが、buildPatterns が既にその判定込みで
// 候補を解決しているので、ここでは機械的に candidates[0] を連結するだけでよい。
function firstCandidateRomaji(kana: string): string {
  return buildPatterns(kana)
    .map((pattern) => pattern.candidates[0])
    .join("");
}

async function typeString(str: string): Promise<void> {
  for (const key of str) {
    await pressKey(key);
  }
}

beforeEach(() => {
  // MessageChannel など React のスケジューラが使う API は fake 化しない。
  // setTimeout/clearTimeout だけを fake にすることで、schedule effect のタイマーだけを制御する。
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  // PlayPage は毎回プールから questionCount 件をランダム抽出・シャッフルする。
  // Math.random を固定値にしておけば、同じ入力に対して selectQuestions は常に同じ結果を
  // 返すので、テスト側で PlayPage が内部で選んだのと同じ出題列を再現できる。
  vi.spyOn(Math, "random").mockReturnValue(0.42);
  // ハイスコア永続化テスト用にストレージをクリア。ブラウザは実 localStorage を持つので、
  // 前のテストが残した値で後続テストが偽陽性/偽陰性にならないようにする。
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

// beforeEach で固定した Math.random と同じ状態で呼べば、PlayPage が内部で選ぶ
// activeQuestions と同じ配列が得られる。land-animals は randomOrder=true なので、
// PlayPage 側と同じフラグを渡してシャッフル経路をなぞる。
function expectedActiveQuestions() {
  return selectQuestions(animalsPool, animalsQuestionCount, animalsRandomOrder);
}

async function playAllQuestions(): Promise<void> {
  for (const question of expectedActiveQuestions()) {
    // 複数読みが定義されていても、代表読み（kanas[0]）どおりに打てば必ず完走できる。
    await typeString(firstCandidateRomaji(question.kanas[0]));
    // 丸演出の CLEAR_DELAY_MS を進めないと次の問題（または done）へ遷移しない。
    await advanceTimers(CLEAR_DELAY_MS);
  }
}

test("初期表示は IdleMessage（問題セット名を表示）", async () => {
  const screen = await renderPlayPage();

  await expect.element(screen.getByText(animalsSet.title)).toBeVisible();
});

test("スペースキーで開始し、countdown 終了後に抽出された最初の問題が表示される", async () => {
  const screen = await renderPlayPage();

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);

  // 見出しとふりがなが同一文字列になる問題（例: うさぎ）だと2箇所ヒットするので先頭で十分。
  const first = expectedActiveQuestions()[0];
  await expect.element(screen.getByText(first.text).first()).toBeVisible();
});

test("questionCount 件を打ち終えると ResultScreen（スコアと もういちど ボタン）が表示される", async () => {
  const screen = await renderPlayPage();

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  await playAllQuestions();

  await expect.element(screen.getByText("スコア")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "もういちど" })).toBeVisible();
});

test("『もどる』リンクは idle / countdown / playing / done のどのフェーズでも常に表示される", async () => {
  const screen = await renderPlayPage();

  // idle
  await expect.element(screen.getByRole("link", { name: "もどる" })).toBeVisible();

  // countdown（Space 直後、まだ 0 ms も進めていない状態）
  await pressKey(" ");
  await expect.element(screen.getByRole("link", { name: "もどる" })).toBeVisible();

  // playing（countdown 終了直後）
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  await expect.element(screen.getByRole("link", { name: "もどる" })).toBeVisible();

  // done（全問プレイ後）
  await playAllQuestions();
  await expect.element(screen.getByText("スコア")).toBeVisible();
  await expect.element(screen.getByRole("link", { name: "もどる" })).toBeVisible();
});

test("『もどる』リンクを押すとトップページに戻る", async () => {
  const screen = await renderPlayPage();

  await screen.getByRole("link", { name: "もどる" }).click();

  // TopPage のヘッダ見出し。/play からトップへ確かに遷移したことの目印にする。
  await expect.element(screen.getByRole("heading", { name: "ジュニアタイピング" })).toBeVisible();
});

test("Strict Mode 下でも初回完走でハイスコア更新バッジが表示される（回帰: recordHighScore を render 中に呼んでいた頃は isNewHigh が反転していた）", async () => {
  // 本番の main.tsx と同じく <StrictMode> でラップして render すると、コンポーネントの
  // render 関数は 1 回のパスにつき 2 度実行される。旧実装は recordHighScore を render
  // 中に呼んでいたため、1 回目の書き込み → 2 回目の読み取りで isNewHigh=false と判定
  // され、バッジが出ずに PreviousHighRow が出るバグがあった。evaluateHighScore（純関数
  // 版）で判定して recordHighScore は useEffect に押し出した修正が効いていれば、
  // Strict Mode でもバッジが可視化される。
  const screen = await renderPlayPageStrict();

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  await playAllQuestions();

  await expect.element(screen.getByRole("status")).toBeVisible();
});

test("全問プレイ後、初回完走なら結果画面にハイスコア更新バッジ（role=status）が表示される", async () => {
  // 初回完走は必ず新記録扱い（前回スコアが存在しないため recordHighScore の
  // isNewHigh が true になる）。バッジの文言は「ハイスコア！」/「パーフェクト！」
  // の 2 種類あり、fake timers 下では elapsedMs=0 で常に満点になる関係で本テストでは
  // 「パーフェクト！」が出るが、テストの目的は "更新演出が出ること" の統合検証なので
  // 文言ではなく role="status" で拾って両方の分岐をまとめてカバーする。
  // 文言ごとの分岐は ResultScreen.browser.test.tsx で別途担保。
  const screen = await renderPlayPage();

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  await playAllQuestions();

  await expect.element(screen.getByRole("status")).toBeVisible();
});

test("全問プレイ後、その setId のハイスコアが localStorage に記録される", async () => {
  const screen = await renderPlayPage();

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  await playAllQuestions();
  // done への遷移で effect が発火してから DOM に反映されるのを待つため、
  // ResultScreen の出現を明示的に待機する。
  await expect.element(screen.getByText("スコア")).toBeVisible();

  // 保存キーとスキーマは services/highScores.ts の実装で決めた JSON blob 形式。
  // 記録されたスコア値そのものはタイマーの実時間の影響を受けるので、
  // ここでは「setId のエントリが存在し、値が 0..MAX_SCORE の整数」であることだけを検証する。
  const raw = localStorage.getItem("junior-typing:high-scores:v1");
  expect(raw).not.toBeNull();
  const parsed = JSON.parse(raw ?? "{}") as Record<string, unknown>;
  const score = parsed["land-animals"];
  expect(typeof score).toBe("number");
  expect(Number.isInteger(score)).toBe(true);
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(MAX_SCORE);
});

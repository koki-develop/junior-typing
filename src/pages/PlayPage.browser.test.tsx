import { render } from "vitest-browser-react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";

// cuelume を叩かず、effect の実行（play 呼び出し）だけを気にせずに全問プレイできるようにする。
vi.mock("cuelume", () => ({ play: vi.fn() }));

import { routeTree } from "../app/router.ts";
import { CLEAR_DELAY_MS, COUNTDOWN_STEP_MS } from "../domain/game/machine.ts";
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
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// beforeEach で固定した Math.random と同じ状態で呼べば、PlayPage が内部で選ぶ
// activeQuestions と同じ配列が得られる。land-animals は randomOrder=true なので、
// PlayPage 側と同じフラグを渡してシャッフル経路をなぞる。
function expectedActiveQuestions() {
  return selectQuestions(animalsPool, animalsQuestionCount, animalsRandomOrder);
}

async function playAllQuestions(): Promise<void> {
  for (const question of expectedActiveQuestions()) {
    await typeString(firstCandidateRomaji(question.kana));
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

test("結果画面から Space キーで idle に戻り、再度プレイを開始できる", async () => {
  // 「もういちど」ボタン単体のクリック挙動は ResultScreen.browser.test.tsx で検証しているので、
  // ここではフル画面遷移をキーボード（machine.ts の done → START_KEY 経路）で確かめる。
  // ボタンクリックだと Keyboard の ResizeObserver 再マウントが act 外の state 更新を起こし
  // 冗長な警告が出るため、pressKey ヘルパー経由で act をきちんと包む形にする。
  const screen = await renderPlayPage();

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  await playAllQuestions();

  await pressKey(" ");

  // idle に戻れば問題セット名の案内が再度出てくる。
  await expect.element(screen.getByText(animalsSet.title)).toBeVisible();

  // そのままスペースキーでもう一度ゲームを始められる。Math.random は固定なので
  // 再抽選後も同じ出題列になり、期待値の再計算は不要。
  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  const first = expectedActiveQuestions()[0];
  await expect.element(screen.getByText(first.text).first()).toBeVisible();
});

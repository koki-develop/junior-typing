import { render } from "vitest-browser-react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// cuelume を叩かず、effect の実行（play 呼び出し）だけを気にせずに全問プレイできるようにする。
vi.mock("cuelume", () => ({ play: vi.fn() }));

import { CLEAR_DELAY_MS, COUNTDOWN_STEP_MS } from "../domain/game/machine.ts";
import { questions } from "../domain/questions/questions.ts";
import { buildPatterns } from "../domain/romaji/patterns.ts";
import { advanceTimers, pressKey } from "../test/browser-helpers.ts";
import App from "./App.tsx";

beforeEach(() => {
  // MessageChannel など React のスケジューラが使う API は fake 化しない。
  // setTimeout/clearTimeout だけを fake にすることで、schedule effect のタイマーだけを制御する。
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

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

test("初期表示は IdleMessage（スタート案内）", async () => {
  const screen = await render(<App />);

  await expect.element(screen.getByText("スタート")).toBeVisible();
});

test("スペースキーで開始し、countdown 終了後に最初の問題が表示される", async () => {
  const screen = await render(<App />);

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);

  // questions[0] はふりがなと見出しが同一文字列なので2箇所ヒットする。先頭の一致で十分。
  await expect.element(screen.getByText(questions[0].text).first()).toBeVisible();
});

test("全問題を最後まで打ち終えると CompletionScreen（終了！）が表示される", async () => {
  const screen = await render(<App />);

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);

  for (const question of questions) {
    await typeString(firstCandidateRomaji(question.kana));
    // 花丸演出の CLEAR_DELAY_MS を進めないと次の問題（または done）へ遷移しない。
    await advanceTimers(CLEAR_DELAY_MS);
  }

  await expect.element(screen.getByText("終了！")).toBeVisible();
});

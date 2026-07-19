import { renderHook } from "vitest-browser-react";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// cuelume を叩かず、GameSound ごとの play 呼び出しだけを検証できるようにする。
vi.mock("cuelume", () => ({ play: vi.fn(), bind: vi.fn() }));

import { play } from "cuelume";
import { CLEAR_DELAY_MS, COUNTDOWN_STEP_MS } from "../../domain/game/machine.ts";
import type { Question } from "../../domain/questions/types.ts";
import { advanceTimers, pressKey } from "../../test/browser-helpers.ts";
import { useTypingGame } from "./useTypingGame.ts";

// 「あ」「い」はどちらも1モーラの問題で、候補が唯一（あ）または先頭候補が明確（い）なので、
// クリア・進行・完了までの流れを最小手数で追える。
const twoQuestions: Question[] = [
  { text: "あ", kanas: ["あ"] },
  { text: "い", kanas: ["い"] },
];

beforeEach(() => {
  vi.mocked(play).mockClear();
  // MessageChannel など React のスケジューラが使う API は fake 化しない。
  // setTimeout/clearTimeout だけを fake にすることで、schedule effect のタイマーだけを制御する。
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

test("初期状態は idle・total は questions.length", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));

  expect(hook.result.current.view.phase).toBe("idle");
  expect(hook.result.current.view.total).toBe(2);
});

test("スペースキーで countdown が始まり bloom 音が鳴る", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));

  await pressKey(" ");

  expect(hook.result.current.view).toMatchObject({ phase: "countdown", count: 3 });
  expect(play).toHaveBeenCalledWith("bloom");
});

test("countdown が3段進むと playing に入り最初の問題を読み込む", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));

  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);

  expect(hook.result.current.view.phase).toBe("playing");
  if (hook.result.current.view.phase === "playing") {
    expect(hook.result.current.view.question).toEqual(twoQuestions[0]);
  }
  expect(play).toHaveBeenCalledWith("ready");
});

test("playing 中の誤入力は phase を変えず error 音を鳴らす", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));
  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);

  await pressKey("z"); // 「あ」の候補 ["a"] には含まれない打鍵

  expect(hook.result.current.view.phase).toBe("playing");
  expect(play).toHaveBeenCalledWith("error");
});

test("正解の最終打鍵で cleared になり、page と success が両方鳴る", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));
  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);

  await pressKey("a"); // 「あ」の唯一の候補で1問目が確定する

  expect(hook.result.current.view).toMatchObject({ phase: "playing", cleared: true });
  expect(play).toHaveBeenCalledWith("page");
  expect(play).toHaveBeenCalledWith("success");
});

test("CLEAR_DELAY_MS 経過後に次の問題へ進む", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));
  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  await pressKey("a");

  await advanceTimers(CLEAR_DELAY_MS);

  expect(hook.result.current.view.phase).toBe("playing");
  if (hook.result.current.view.phase === "playing") {
    expect(hook.result.current.view.questionIndex).toBe(1);
    expect(hook.result.current.view.question).toEqual(twoQuestions[1]);
    expect(hook.result.current.view.cleared).toBe(false);
  }
});

test("2問とも打ち終えると done になり、result にスコア/キー数/経過時間が入る", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));
  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);

  await pressKey("a");
  await advanceTimers(CLEAR_DELAY_MS);
  await pressKey("z"); // 意図的に 1 ミス
  await pressKey("i"); // 「い」の先頭候補
  await advanceTimers(CLEAR_DELAY_MS);

  expect(hook.result.current.view.phase).toBe("done");
  if (hook.result.current.view.phase === "done") {
    // 正解 2 打鍵（"a", "i"）とミス 1 打鍵。
    expect(hook.result.current.view.result.correctKeys).toBe(2);
    expect(hook.result.current.view.result.wrongKeys).toBe(1);
    expect(hook.result.current.view.result.totalKeys).toBe(3);
    // 経過時間は必ず正の値。fake timer で進めた分だけ Date.now() は進まないが、
    // 少なくとも 0 以上であることは保証したい。
    expect(hook.result.current.view.result.elapsedMs).toBeGreaterThanOrEqual(0);
  }
});

test("restart() で done から idle に戻り、再度スペースでゲームを開始できる", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));
  await pressKey(" ");
  await advanceTimers(COUNTDOWN_STEP_MS * 3);
  await pressKey("a");
  await advanceTimers(CLEAR_DELAY_MS);
  await pressKey("i");
  await advanceTimers(CLEAR_DELAY_MS);
  expect(hook.result.current.view.phase).toBe("done");

  await act(async () => {
    hook.result.current.restart();
  });

  expect(hook.result.current.view.phase).toBe("idle");
  expect(hook.result.current.view.total).toBe(2);

  // 再度スペースキーで countdown に入れる。
  await pressKey(" ");
  expect(hook.result.current.view).toMatchObject({ phase: "countdown" });
});

test("countdown 中にアンマウントすると保留中のタイマーが解除され、以降の発火は無害", async () => {
  const hook = await renderHook(() => useTypingGame(twoQuestions));
  await pressKey(" "); // countdown 開始、tick が schedule される

  const callsBeforeUnmount = vi.mocked(play).mock.calls.length;
  await hook.unmount();

  expect(() => {
    vi.advanceTimersByTime(COUNTDOWN_STEP_MS * 3);
  }).not.toThrow();
  // アンマウント時に timersRef のタイマーが clearTimeout されているので、
  // 以降の advance では tick も enterQuestion の "ready" 再生も発生しない。
  expect(vi.mocked(play).mock.calls.length).toBe(callsBeforeUnmount);
});

// countdown 中に questions が差し替わっても、schedule された tick は dispatchRef 経由で
// 常に「最新レンダーの dispatch（＝最新の questions を閉じ込めた dispatch）」を呼ぶ。
// ここが壊れると countdown 完了時に古い questions の問題が読み込まれてしまう。
test("countdown 中に questions が差し替わると、新しい questions の先頭問題で playing に入る", async () => {
  const questionsA: Question[] = [{ text: "あ", kanas: ["あ"] }];
  const questionsB: Question[] = [{ text: "い", kanas: ["い"] }];

  const hook = await renderHook(
    // initialProps を必ず渡すので実行時に undefined になることはないが、
    // renderHook のシグネチャ上は省略可能な引数なので受け口も optional にしておく。
    (props?: { questions: Question[] }) => useTypingGame(props!.questions),
    { initialProps: { questions: questionsA } },
  );

  await pressKey(" ");
  await hook.rerender({ questions: questionsB });
  await advanceTimers(COUNTDOWN_STEP_MS * 3);

  expect(hook.result.current.view.phase).toBe("playing");
  if (hook.result.current.view.phase === "playing") {
    expect(hook.result.current.view.question).toEqual(questionsB[0]);
  }
});

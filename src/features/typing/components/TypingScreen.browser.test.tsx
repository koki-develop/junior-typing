import { render } from "vitest-browser-react";
import { expect, test } from "vitest";
import type { GameView } from "../../../domain/game/view.ts";
import type { Question } from "../../../domain/questions/types.ts";
import { TypingScreen } from "./TypingScreen.tsx";

// TypingScreen は GameView.phase で ProgressBar / 中央スロット / Keyboard の連携を組み立てる
// だけのシェルなので、useTypingGame を経由せず GameView を直接組み立てて各フェーズを検証する。
// satisfies で GameView 型に合わせておくことで、型が drift したら気づけるようにする。

const question: Question = { text: "柿", kana: "かき" };

// sr-only は aria-live 領域だけが持つクラスなので、ページ上で唯一のセレクタとして使える。
function getLiveRegion(container: HTMLElement) {
  return container.querySelector(".sr-only");
}

// bg-accent は ProgressBar の current/done セグメントにも使われているクラスなので、
// KeyCap 特有の rounded-lg（セグメントは rounded-full）を組み合わせて絞り込む。
function getHighlightedKeyCaps(container: HTMLElement) {
  return container.querySelectorAll(".bg-accent.rounded-lg");
}

test("idle: 進捗 0 / どのセグメントもアクティブでない / Space キー強調 / IdleMessage / live 空", async () => {
  const view = { phase: "idle", total: 5 } satisfies GameView;
  const screen = await render(<TypingScreen view={view} title="どうぶつ" />);

  const bar = screen.getByRole("progressbar", { name: "タイピング進捗" });
  await expect.element(bar).toHaveAttribute("aria-valuenow", "0");
  // 1 問目のセグメントは countdown 終了後に初めてアクティブになる契約。
  // idle 時点で aria-current='step' を持つセグメントが 1 つも無いことを保証する。
  expect(screen.container.querySelectorAll("[aria-current='step']")).toHaveLength(0);

  expect(getHighlightedKeyCaps(screen.container)).toHaveLength(1);

  await expect.element(screen.getByText("どうぶつ")).toBeVisible();

  const live = getLiveRegion(screen.container);
  expect(live).not.toBeNull();
  expect(live?.textContent).toBe("");
});

test("countdown: live 領域が count を文字列として反映し、進捗バーはまだアクティブにならない", async () => {
  const view = { phase: "countdown", total: 5, count: 3 } satisfies GameView;
  const screen = await render(<TypingScreen view={view} title="どうぶつ" />);

  const live = getLiveRegion(screen.container);
  expect(live?.textContent).toBe("3");

  const countdownNumber = screen.container.querySelector(".animate-countdown-pop");
  expect(countdownNumber).not.toBeNull();
  expect(countdownNumber?.textContent).toBe("3");

  // カウントダウン中もまだ 1 問目には入っていない扱い。aria-current='step' は付かない。
  expect(screen.container.querySelectorAll("[aria-current='step']")).toHaveLength(0);
});

test("playing: 進捗が questionIndex に追従し、QuestionDisplay と次キーの KeyCap 強調を表示する", async () => {
  const view = {
    phase: "playing",
    total: 5,
    questionIndex: 2,
    question,
    typed: "ka",
    next: "k",
    rest: "i",
    cleared: false,
  } satisfies GameView;
  const screen = await render(<TypingScreen view={view} title="どうぶつ" />);

  const bar = screen.getByRole("progressbar", { name: "タイピング進捗" });
  await expect.element(bar).toHaveAttribute("aria-valuenow", "2");

  await expect.element(screen.getByText("柿")).toBeVisible();

  const highlighted = getHighlightedKeyCaps(screen.container);
  expect(highlighted).toHaveLength(1);
  expect(highlighted[0].textContent).toBe("K");
});

test("playing かつ cleared で next が空文字のときは KeyCap を強調しない", async () => {
  const view = {
    phase: "playing",
    total: 5,
    questionIndex: 2,
    question,
    typed: "kaki",
    next: "",
    rest: "",
    cleared: true,
  } satisfies GameView;
  const screen = await render(<TypingScreen view={view} title="どうぶつ" />);

  expect(getHighlightedKeyCaps(screen.container)).toHaveLength(0);
});

// cleared=true のクリア演出中は、現在セグメントの内側に accent の fill 子要素が挿入され、
// scaleX(0→1) の progress-fill アニメが走る。cleared=false → true の切り替わりで
// この子要素が「無い → 有る」になるのが視覚的な進行感の源。
test("playing かつ cleared のときは現在セグメントに fill アニメの子要素が入る", async () => {
  const view = {
    phase: "playing",
    total: 5,
    questionIndex: 2,
    question,
    typed: "kaki",
    next: "",
    rest: "",
    cleared: true,
  } satisfies GameView;
  const screen = await render(<TypingScreen view={view} title="どうぶつ" />);

  const currents = screen.container.querySelectorAll("[aria-current='step']");
  expect(currents).toHaveLength(1);
  const fill = currents[0].querySelector(".animate-progress-fill");
  expect(fill).not.toBeNull();
});

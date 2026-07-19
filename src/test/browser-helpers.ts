import { act } from "react";
import { vi } from "vitest";

// vitest-browser-react の render/renderHook は自分の act 呼び出しの間だけ
// IS_REACT_ACT_ENVIRONMENT を true にし、呼び出しが終わるたびに false へ戻す。
// そのため react から act を直に使うたびに毎回 true へ立て直さないと
// "not configured to support act(...)" という console.error が出る（実害はないがノイズになる）。
function markActEnvironment(): void {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

// keydown も timer 発火も useState を更新するため、act で包んで結果を同期的に確定させてから読む。
// useTypingGame と App の統合テストで共通に必要なので browser-helpers に集約する。
export async function pressKey(key: string): Promise<void> {
  markActEnvironment();
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key }));
  });
}

export async function advanceTimers(ms: number): Promise<void> {
  markActEnvironment();
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// pressKey/advanceTimers に当てはまらない、任意の state 更新を伴う非同期処理
// （例: router.navigate()）を act で包んで同期的に確定させるための汎用ヘルパー。
export async function runInAct(fn: () => void | Promise<void>): Promise<void> {
  markActEnvironment();
  await act(async () => {
    await fn();
  });
}

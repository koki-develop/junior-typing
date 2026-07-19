import { renderHook } from "vitest-browser-react";
import { expect, test, vi } from "vitest";
import { useKeyboard } from "./useKeyboard.ts";
import type { KeyboardSend } from "./useKeyboard.ts";

// window に実際の KeyboardEvent を dispatch して useKeyboard の変換ロジックを検証する。
// cancelable: true を明示しないと preventDefault() を呼んでも defaultPrevented が立たない。
function dispatchKeyDown(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

test("1文字の keydown を { type: 'key', key } として send する", async () => {
  const send = vi.fn<KeyboardSend>();
  await renderHook(() => useKeyboard(send));

  dispatchKeyDown({ key: "f" });

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "key", key: "f" });
});

test("Shift 押下による大文字キーも小文字化してから send する", async () => {
  const send = vi.fn<KeyboardSend>();
  await renderHook(() => useKeyboard(send));

  dispatchKeyDown({ key: "A", shiftKey: true });

  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "key", key: "a" });
});

test("スペースキーはページスクロールを避けるため preventDefault される", async () => {
  const send = vi.fn<KeyboardSend>();
  await renderHook(() => useKeyboard(send));

  const event = dispatchKeyDown({ key: " " });

  expect(event.defaultPrevented).toBe(true);
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "key", key: " " });
});

test("meta/ctrl/alt を伴う組み合わせキーは無視する", async () => {
  const send = vi.fn<KeyboardSend>();
  await renderHook(() => useKeyboard(send));

  dispatchKeyDown({ key: "a", metaKey: true });
  dispatchKeyDown({ key: "a", ctrlKey: true });
  dispatchKeyDown({ key: "a", altKey: true });

  expect(send).not.toHaveBeenCalled();
});

test("1文字でない特殊キーは無視する", async () => {
  const send = vi.fn<KeyboardSend>();
  await renderHook(() => useKeyboard(send));

  for (const key of ["Enter", "ArrowUp", "Escape", "F1", "Tab"]) {
    dispatchKeyDown({ key });
  }

  expect(send).not.toHaveBeenCalled();
});

test("アンマウント後は keydown リスナーが解除され send は呼ばれない", async () => {
  const send = vi.fn<KeyboardSend>();
  const { unmount } = await renderHook(() => useKeyboard(send));

  await unmount();
  send.mockClear();
  dispatchKeyDown({ key: "a" });

  expect(send).not.toHaveBeenCalled();
});

// sendRef はレンダーのたびに最新の send を掴み直すための仕組み（useKeyboard.ts 参照）。
// 古い send クロージャに配線されたままにならないことをここで固定する。
test("再レンダーで send が差し替わると、以降の keydown は最新の send にだけ届く", async () => {
  const firstSend = vi.fn<KeyboardSend>();
  const secondSend = vi.fn<KeyboardSend>();
  const { rerender } = await renderHook(
    // initialProps を必ず渡すので実行時に undefined になることはないが、
    // renderHook のシグネチャ上は省略可能な引数なので受け口も optional にしておく。
    (props?: { send: KeyboardSend }) => useKeyboard(props!.send),
    { initialProps: { send: firstSend } },
  );

  await rerender({ send: secondSend });
  dispatchKeyDown({ key: "a" });

  expect(secondSend).toHaveBeenCalledExactlyOnceWith({ type: "key", key: "a" });
  expect(firstSend).not.toHaveBeenCalled();
});

import { useEffect, useRef } from "react";
import { START_KEY } from "../../domain/game/machine.ts";

// 打鍵を GameEvent の key バリアントに変換して送るコールバック。now は useTypingGame 側で焼き込む。
export type KeyboardSend = (event: { type: "key"; key: string }) => void;

// window の keydown を GameEvent に変換して send に渡す。
// リスナーはマウント時に一度だけ登録する。send はレンダーのたびに新しい参照になり得るため、
// 依存配列を空にしたまま常に最新の send を呼べるよう ref 経由で保持する。
export function useKeyboard(send: KeyboardSend): void {
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      // スペースはブラウザのページスクロールを誘発するため、常に抑止する。
      // idle では開始トリガー、playing では未使用の打鍵として扱うが、いずれもスクロールされたくない。
      if (event.key === START_KEY) event.preventDefault();
      // CapsLock や Shift 時の大文字も正しく判定できるよう小文字に正規化する。
      sendRef.current({ type: "key", key: event.key.toLowerCase() });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

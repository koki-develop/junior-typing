import { useEffect, useRef, useState } from "react";
import { createInitialState, transition } from "../../domain/game/machine.ts";
import type { GameEvent, GameState } from "../../domain/game/machine.ts";
import { selectView } from "../../domain/game/view.ts";
import type { GameView } from "../../domain/game/view.ts";
import type { Question } from "../../domain/questions/types.ts";
import { playSound } from "../../services/sound.ts";
import { useKeyboard } from "./useKeyboard.ts";

// 出題リストを引き取り、キーボード入力を購読して状態を進める薄いアダプタ。
// 状態遷移そのものは domain/game/machine.ts の transition（純粋関数）に委譲し、
// このフックは state の保持と effects（playSound / schedule）の実行だけを担う。
//
// 3つの参照の役割分担:
// - useState<GameState>: レンダーの唯一の情報源。view はここから selectView で
//   毎レンダー導出する（純粋関数なのでレンダー中に呼んでよく、React Compiler がメモ化する）。
// - stateRef: send がイベントハンドラ / タイマーコールバックから「今の state」を
//   同期的に読むための参照。setState の反映は非同期なので、同一 tick で send が
//   連続しても常に最新の state から遷移できるよう setState と隣接して更新する。
// - sendRef: setTimeout に渡すコールバックは登録時点の send クロージャ（延いては
//   登録時点の questions）を掴んだままレンダーをまたいで生き続ける。schedule のたびに
//   最新の send へ更新される ref 越しに呼ぶことで、古いクロージャで送られるのを防ぐ。
export function useTypingGame(questions: readonly Question[]): GameView {
  const [state, setState] = useState<GameState>(createInitialState);
  const stateRef = useRef<GameState>(state);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const send = (event: GameEvent) => {
    const result = transition(stateRef.current, event, questions);
    stateRef.current = result.state;
    // transition は無視されたイベント（例: countdown 中の打鍵）で同一参照の state を返す。
    // 同一参照なら setState 自身のベイルアウトが再レンダーを抑制するので、
    // ここで変化の有無を手動判定する必要はない。
    setState(result.state);

    for (const effect of result.effects) {
      if (effect.type === "playSound") {
        playSound(effect.sound);
        continue;
      }
      // schedule: delayMs 後に effect.event を send し直す。
      // 発火前にアンマウントされた場合に備えて timersRef で管理し、
      // 発火後は自分自身を timersRef から取り除く。
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        sendRef.current(effect.event);
      }, effect.delayMs);
      timersRef.current.add(timer);
    }
  };

  // 毎レンダー最新の send に更新する。useKeyboard の sendRef と同じパターン。
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  useKeyboard(send);

  // アンマウント時に未着火タイマーを全部片付ける。
  // フェーズ遷移による stale tick は transition 側のフェーズガードで無害化されるので、
  // 遷移のたびの個別キャンセルは不要。
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  return selectView(state, questions);
}

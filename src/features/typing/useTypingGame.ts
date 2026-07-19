import { useEffect, useRef, useState } from "react";
import { createInitialState, transition } from "../../domain/game/machine.ts";
import type { GameEvent, GameState } from "../../domain/game/machine.ts";
import { selectView } from "../../domain/game/view.ts";
import type { GameView } from "../../domain/game/view.ts";
import type { Question } from "../../domain/questions/types.ts";
import { playSound } from "../../services/sound.ts";
import { useKeyboard } from "./useKeyboard.ts";

// dispatch に渡すイベント形式。now は dispatch が Date.now() で焼き込むので、
// 呼び出し側は now を意識しない。restart のみ最初から now を持たないイベントで、そのまま流す。
type DispatchEvent =
  | { type: "key"; key: string }
  | { type: "tick" }
  | { type: "advance" }
  | { type: "restart" };

// 出題リストを引き取り、キーボード入力を購読して状態を進める薄いアダプタ。
// 状態遷移そのものは domain/game/machine.ts の transition（純粋関数）に委譲し、
// このフックは state の保持と effects（playSound / schedule）の実行、
// および GameEvent への now(ms) の焼き込みだけを担う。
//
// 3つの参照の役割分担:
// - useState<GameState>: レンダーの唯一の情報源。view はここから selectView で
//   毎レンダー導出する（純粋関数なのでレンダー中に呼んでよく、React Compiler がメモ化する）。
// - stateRef: dispatch がイベントハンドラ / タイマーコールバックから「今の state」を
//   同期的に読むための参照。setState の反映は非同期なので、同一 tick で dispatch が
//   連続しても常に最新の state から遷移できるよう setState と隣接して更新する。
// - dispatchRef: setTimeout に渡すコールバックは登録時点の dispatch クロージャ（延いては
//   登録時点の questions）を掴んだままレンダーをまたいで生き続ける。schedule のたびに
//   最新の dispatch へ更新される ref 越しに呼ぶことで、古いクロージャで送られるのを防ぐ。
export function useTypingGame(questions: readonly Question[]): {
  view: GameView;
  restart: () => void;
} {
  const [state, setState] = useState<GameState>(createInitialState);
  const stateRef = useRef<GameState>(state);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const dispatch = (event: DispatchEvent) => {
    // restart 以外の GameEvent には発生時刻を焼き込む。transition はこの now を使って
    // startedAt / endedAt を焼き込み、時間依存の派生値（経過時間・スコア）を可能にする。
    const stamped: GameEvent = event.type === "restart" ? event : { ...event, now: Date.now() };
    const result = transition(stateRef.current, stamped, questions);
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
      // schedule: delayMs 後に effect.event を dispatch し直す。
      // 発火前にアンマウントされた場合に備えて timersRef で管理し、
      // 発火後は自分自身を timersRef から取り除く。
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        dispatchRef.current(effect.event);
      }, effect.delayMs);
      timersRef.current.add(timer);
    }
  };

  // 毎レンダー最新の dispatch に更新する。useKeyboard の sendRef と同じパターン。
  const dispatchRef = useRef(dispatch);
  useEffect(() => {
    dispatchRef.current = dispatch;
  });

  useKeyboard(dispatch);

  // アンマウント時に未着火タイマーを全部片付ける。
  // フェーズ遷移による stale tick は transition 側のフェーズガードで無害化されるので、
  // 遷移のたびの個別キャンセルは不要。
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  // 呼び出し側（結果画面のボタンなど）から restart を発火するためのハンドル。
  // ref 越しに最新の dispatch を呼ぶことで、常に最新の questions を閉じ込めた
  // dispatch へ委譲できる（メモ化は React Compiler に任せる）。
  const restart = () => {
    dispatchRef.current({ type: "restart" });
  };

  return { view: selectView(state, questions), restart };
}

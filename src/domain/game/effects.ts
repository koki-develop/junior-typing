// domain は cuelume に依存しない。実際に使う効果音だけを独自 union として定義し、
// SoundName への変換は呼び出し側（services 層）に委ねる。
export type GameSound = "bloom" | "ready" | "page" | "error" | "success";

// schedule effect が「delayMs 後に send し直したい」イベントの型。
// GameEvent 本体は now(ms) を持つが、schedule では発火時点の時刻を
// 実行側（useTypingGame）で焼き込むので、event ペイロードには now を含めない。
export type ScheduledEvent = { type: "tick" } | { type: "advance" };

// 副作用を「宣言」として遷移の戻り値に含める。playSound はそのまま鳴らせばよく、
// schedule は delayMs 後に event を send し直す実行を呼び出し側に要求する。
// タイマーの発火自体を GameEvent として表現しているため、遅延実行の結果も
// transition の中でフェーズガードでき、stale なタイマーは自然に無害化される。
export type GameEffect =
  | { type: "playSound"; sound: GameSound }
  | { type: "schedule"; event: ScheduledEvent; delayMs: number };

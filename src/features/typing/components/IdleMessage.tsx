import { PhaseLayout } from "./PhaseLayout.tsx";

// 開始待ち画面。QuestionDisplay / CountdownMessage と PhaseLayout を共有することで、
// 縦寸法を揃え idle → countdown → playing の遷移中に下段の Keyboard が上下に跳ねないようにする。
export function IdleMessage() {
  return (
    <PhaseLayout
      main={<p className="text-ink">スタート</p>}
      bottom={<span className="text-muted">スペースキーで開始</span>}
    />
  );
}

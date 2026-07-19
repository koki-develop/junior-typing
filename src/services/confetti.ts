// canvas-confetti は DOM の canvas を直接操作する命令的な関数で、React の
// ライフサイクルに依存せず任意のタイミング（イベントハンドラ、effect の
// onComplete など）から直接呼べる。sound.ts と同じく、外部ライブラリへの
// 依存を隠すだけの薄いアダプタとして services 層に置く。
import confetti from "canvas-confetti";

// 画面中央よりやや下（y: 0.6）を起点に紙吹雪を広げる、汎用的な「達成」演出。
// disableForReducedMotion で prefers-reduced-motion ユーザーには自動的に
// 演出をスキップする（canvas-confetti 側の標準対応）。
export function fireConfetti(): void {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    disableForReducedMotion: true,
  });
}

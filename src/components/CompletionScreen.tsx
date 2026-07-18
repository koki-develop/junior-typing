// 全問クリア時に表示する画面。
export function CompletionScreen() {
  return (
    <div className="grid place-items-center gap-3 text-center">
      <p className="text-6xl font-medium tracking-[0.04em] text-accent">終了！</p>
      <p className="text-lg text-muted">おつかれさまでした</p>
    </div>
  );
}

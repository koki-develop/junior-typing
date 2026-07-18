type Props = {
  total: number;
  // 現在挑戦中の問題のインデックス（0 始まり）。
  currentIndex: number;
};

// 出題数と同数のセグメントを横に並べた進捗バー。
// 現在位置のセグメントは薄いグローで強調する。
export function ProgressBar({ total, currentIndex }: Props) {
  return (
    <div
      className="flex justify-center gap-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(currentIndex, total)}
      aria-label="タイピング進捗"
    >
      {Array.from({ length: total }, (_, i) => (
        <ProgressSegment
          key={i}
          state={i < currentIndex ? "done" : i === currentIndex ? "current" : "remaining"}
        />
      ))}
    </div>
  );
}

type SegmentState = "done" | "current" | "remaining";

function ProgressSegment({ state }: { state: SegmentState }) {
  const base = "h-1.5 w-12 rounded-full";
  if (state === "remaining") return <span className={`${base} bg-faint`} />;
  if (state === "done") return <span className={`${base} bg-accent`} />;
  return (
    <span
      className={`${base} bg-accent shadow-[0_0_0_4px_rgba(240,82,58,0.16)]`}
      aria-current="step"
    />
  );
}

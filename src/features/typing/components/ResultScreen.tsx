import type { GameResult } from "../../../domain/game/score.ts";

type Props = {
  result: GameResult;
  onRestart: () => void;
};

// 全問クリア後に表示する結果画面。
// スコアを大きく強調しつつ、小学生向けに漢字を控えたラベルで打鍵数・ミス数・時間を並べる。
// 「もういちど」ボタンでリスタート。キーボードでは Space でも再開できる（machine.ts の done で処理）。
export function ResultScreen({ result, onRestart }: Props) {
  return (
    <div className="grid place-items-center gap-10 text-center">
      <div className="grid place-items-center gap-2">
        <p className="text-lg tracking-[0.28em] text-muted">スコア</p>
        <p
          aria-label={`スコア ${result.score}`}
          className="font-mono text-[clamp(72px,10vw,120px)] font-medium leading-none tracking-tight tabular-nums text-accent"
        >
          {result.score}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_auto] gap-x-8 gap-y-3 text-xl md:text-2xl">
        <StatRow label="うったキー" value={`${result.totalKeys}`} />
        <StatRow label="まちがえたキー" value={`${result.wrongKeys}`} />
        <StatRow label="かかったじかん" value={`${formatSeconds(result.elapsedMs)}びょう`} />
      </dl>

      <div className="grid place-items-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full bg-accent px-8 py-3 font-round text-2xl font-medium text-canvas transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          もういちど
        </button>
        <span className="text-muted">スペースキーでもう1回</span>
      </div>
    </div>
  );
}

// ラベルと値を dt/dd で並べる 1 行。ラベルは左寄せ、値は等幅数字で右寄せ揃え。
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="justify-self-start text-muted">{label}</dt>
      <dd className="justify-self-end font-mono font-medium tabular-nums text-ink">{value}</dd>
    </>
  );
}

// 経過時間 ms を「小数第一位までの秒」に整形する。切り捨てで表示（切り上げると 9.98 → 10.0 の
// ように直感と外れるため）。
function formatSeconds(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const whole = Math.floor(tenths / 10);
  const decimal = tenths % 10;
  return `${whole}.${decimal}`;
}

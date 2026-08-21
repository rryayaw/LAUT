import type { DistributionBin } from "../types/analysis.types";

type YieldDistributionChartProps = {
  bins: DistributionBin[];
  focusLabel?: string;
};

export function YieldDistributionChart({ bins, focusLabel }: Readonly<YieldDistributionChartProps>) {
  const tallest = Math.max(1, ...bins.map((bin) => bin.count));

  return (
    <div className="px-5 py-5">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Comparable spread</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="distribution-title">Yield distribution</h2>
        </div>
        {focusLabel ? (
          <p className="text-right text-xs leading-5 text-[var(--muted)]">
            Highlighted bar contains<br /><span className="font-mono font-semibold text-[var(--risk)]">{focusLabel}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex h-40 items-end gap-2" role="img" aria-labelledby="distribution-title">
        {bins.map((bin) => (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={bin.rangeLabel}>
            <span className="font-mono text-[11px] text-[var(--muted)]">{bin.count}</span>
            <div
              className={bin.containsFocus ? "w-full bg-[var(--risk)]" : "w-full bg-[var(--brand)]"}
              style={{ height: `${Math.max(4, (bin.count / tallest) * 100)}%` }}
              title={`${bin.count} batches between ${bin.rangeLabel}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {bins.map((bin) => (
          <p className="min-w-0 flex-1 text-center font-mono text-[10px] text-[var(--muted)]" key={bin.rangeLabel}>
            {bin.rangeLabel}
          </p>
        ))}
      </div>

      <table className="sr-only">
        <caption>Count of confirmed batches by sellable yield range</caption>
        <thead><tr><th>Yield range</th><th>Batches</th></tr></thead>
        <tbody>{bins.map((bin) => <tr key={bin.rangeLabel}><td>{bin.rangeLabel}</td><td>{bin.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

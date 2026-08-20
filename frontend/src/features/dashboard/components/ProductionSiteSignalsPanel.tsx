import type { ProductionSiteSignal } from "../placeholder/dashboard-data";

export function ProductionSiteSignalsPanel({ signals }: Readonly<{ signals: ProductionSiteSignal[] }>) {
  return (
    <div>
      <div className="border-b border-[var(--line)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted)]">Association review</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight" id="signals-title">Production site signals</h2>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {signals.map((signal) => (
          <article className="px-5 py-4" key={signal.productionSite}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">{signal.productionSite}</h3>
              <span className="font-mono text-xs text-[var(--muted)]">{signal.batches} batches</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{signal.note}</p>
            <dl className="mt-3 grid grid-cols-3 border-t border-[var(--line)] pt-3">
              <SignalStat label="Median" value={`${signal.medianYield}%`} />
              <SignalStat label="Reject" value={`${signal.rejectRate}%`} />
              <SignalStat label="Delayed" value={`${signal.delayRate}%`} />
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

function SignalStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><dt className="text-[10px] font-medium text-[var(--muted)]">{label}</dt><dd className="mt-1 font-mono text-xs font-semibold">{value}</dd></div>;
}

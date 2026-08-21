import type { LossTrendRow } from "../types/analysis.types";

const series = [
  { key: "trimmingPct" as const, label: "Trimming", className: "bg-[var(--primary-source)]" },
  { key: "rejectPct" as const, label: "Quality reject", className: "bg-[var(--risk)]" },
  { key: "spoilagePct" as const, label: "Spoilage", className: "bg-[var(--sidebar-muted)]" }
];

export function LossTrendPanel({ rows }: Readonly<{ rows: LossTrendRow[] }>) {
  const tallest = Math.max(
    1,
    ...rows.flatMap((row) => [row.trimmingPct, row.rejectPct, row.spoilagePct])
  );

  return (
    <div className="px-5 py-5">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Loss categories</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="loss-trend-title">Loss ratios over time</h2>
        </div>
        <div className="flex gap-4">
          {series.map((item) => (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]" key={item.key}>
              <span aria-hidden="true" className={`h-2 w-2 ${item.className}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex h-36 items-end gap-3" role="img" aria-labelledby="loss-trend-title">
        {rows.map((row) => (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={row.label}>
            <div className="flex h-full w-full items-end justify-center gap-0.5">
              {series.map((item) => (
                <div
                  className={`w-2 ${item.className}`}
                  key={item.key}
                  style={{ height: `${Math.max(2, (row[item.key] / tallest) * 100)}%` }}
                  title={`${item.label} on ${row.label}: ${row[item.key]}% (${row.batchCount} ${row.batchCount === 1 ? "batch" : "batches"})`}
                />
              ))}
            </div>
            <p className="font-mono text-[10px] text-[var(--muted)]">{row.label}</p>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>Loss ratios by production date</caption>
        <thead><tr><th>Date</th><th>Batches</th><th>Trimming</th><th>Quality reject</th><th>Spoilage</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}><td>{row.label}</td><td>{row.batchCount}</td><td>{row.trimmingPct}%</td><td>{row.rejectPct}%</td><td>{row.spoilagePct}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

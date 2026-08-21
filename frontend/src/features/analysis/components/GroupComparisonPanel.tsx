"use client";

import type { AnalysisDimension, GroupComparison } from "../types/analysis.types";

const dimensionLabels: Record<AnalysisDimension, string> = {
  line: "Production line",
  supplier: "Supplier",
  shift: "Shift",
  fishSize: "Fish size"
};

type GroupComparisonPanelProps = {
  comparisons: Record<AnalysisDimension, GroupComparison[]>;
  dimension: AnalysisDimension;
  onChangeDimension: (dimension: AnalysisDimension) => void;
};

export function GroupComparisonPanel({ comparisons, dimension, onChangeDimension }: Readonly<GroupComparisonPanelProps>) {
  const rows = comparisons[dimension];
  const best = rows.length > 0 ? Math.max(...rows.map((row) => row.medianYieldPct)) : 0;

  return (
    <div>
      <div className="flex items-end justify-between gap-6 border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Group comparison</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="comparison-title">Yield by {dimensionLabels[dimension].toLowerCase()}</h2>
        </div>
        <div className="flex gap-1.5" role="tablist">
          {(Object.keys(dimensionLabels) as AnalysisDimension[]).map((value) => (
            <button
              aria-selected={value === dimension}
              className={`border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${
                value === dimension
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
              key={value}
              onClick={() => onChangeDimension(value)}
              role="tab"
              type="button"
            >
              {dimensionLabels[value]}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-xs font-medium text-[var(--muted)]">
          <tr>
            <th className="px-5 py-3 font-medium">{dimensionLabels[dimension]}</th>
            <th className="px-4 py-3 font-medium">Batches</th>
            <th className="px-4 py-3 font-medium">Median yield</th>
            <th className="px-4 py-3 font-medium">Reject</th>
            <th className="px-4 py-3 font-medium">Trimming</th>
            <th className="px-4 py-3 font-medium">Delayed arrivals</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {rows.map((row) => {
            const gap = Math.round((row.medianYieldPct - best) * 10) / 10;
            return (
              <tr className="transition-colors duration-150 hover:bg-[var(--surface-subtle)]" key={row.group}>
                <td className="px-5 py-3.5 font-medium text-[var(--ink)]">{row.group}</td>
                <td className="px-4 py-3.5 font-mono text-xs text-[var(--muted)]">{row.batches}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-semibold ${gap <= -1.5 ? "text-[var(--risk)]" : "text-[var(--brand)]"}`}>
                      {row.medianYieldPct}%
                    </span>
                    {gap < 0 ? <span className="font-mono text-[10px] text-[var(--muted)]">{gap} pp</span> : null}
                  </div>
                  <div className="mt-1.5 h-1 w-full bg-[var(--surface-pressed)]">
                    <div
                      className={gap <= -1.5 ? "h-1 bg-[var(--risk)]" : "h-1 bg-[var(--brand)]"}
                      style={{ width: `${best > 0 ? (row.medianYieldPct / best) * 100 : 0}%` }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs">{row.rejectPct}%</td>
                <td className="px-4 py-3.5 font-mono text-xs">{row.trimmingPct}%</td>
                <td className={`px-4 py-3.5 font-mono text-xs ${row.delayedShare >= 50 ? "text-[var(--risk)]" : "text-[var(--muted)]"}`}>
                  {row.delayedShare}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="border-t border-[var(--line)] px-5 py-3 text-[11px] leading-4 text-[var(--muted)]">
        Groups are compared on confirmed batches of the same species and specification. Differences show
        association, not cause, and small groups may move on a single batch.
      </p>
    </div>
  );
}

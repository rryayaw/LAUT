"use client";

import type { BatchListItem } from "@/types/domain";
import { AnomalyTag, BatchStatusTag } from "./BatchStatusTag";

type BatchesLedgerTableProps = {
  batches: BatchListItem[];
  selectedBatchId?: string;
  onSelectBatch: (batchId: string) => void;
};

export function BatchesLedgerTable({ batches, onSelectBatch, selectedBatchId }: Readonly<BatchesLedgerTableProps>) {
  const trusted = batches.filter((batch) => ["confirmed", "analyzed", "closed"].includes(batch.status));

  return (
    <section aria-labelledby="batch-ledger-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-end justify-between gap-6 border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Production ledger</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="batch-ledger-title">Reported batches</h2>
        </div>
        <p className="text-right text-xs leading-5 text-[var(--muted)]">
          {batches.length} records<br />{trusted.length} trusted for comparison
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-xs font-medium text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Site and lines</th>
              <th className="px-4 py-3 font-medium">Input</th>
              <th className="px-4 py-3 font-medium">Yield</th>
              <th className="px-4 py-3 font-medium">Signal</th>
              <th className="px-4 py-3 font-medium">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {batches.map((batch) => {
              const isSelected = batch.id === selectedBatchId;
              const { metrics, baseline, anomaly } = batch.analysis;
              const delta =
                metrics.sellableYieldPct !== undefined && baseline
                  ? Math.round((metrics.sellableYieldPct - baseline.medianYieldPct) * 10) / 10
                  : undefined;

              return (
                <tr
                  aria-current={isSelected ? "true" : undefined}
                  className={`cursor-pointer transition-colors duration-150 ${isSelected ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--surface-subtle)]"}`}
                  key={batch.id}
                  onClick={() => onSelectBatch(batch.id)}
                >
                  <td className={`px-5 py-3.5 ${isSelected ? "border-l-2 border-[var(--brand)] pl-[18px]" : ""}`}>
                    <button
                      className="font-mono text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                      onClick={() => onSelectBatch(batch.id)}
                      type="button"
                    >
                      {batch.code}
                    </button>
                    <p className="mt-1 text-xs text-[var(--muted)]">{batch.reportedAt}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-[var(--ink)]">{batch.species}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{batch.source === "whatsapp" ? "WhatsApp" : batch.source === "iot" ? "IoT" : "Web"} · {batch.shift}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs font-medium text-[var(--ink)]">{batch.lineNames.join(", ")}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{batch.siteName}</p>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs font-medium">{batch.quantities.rawInputKg} kg</td>
                  <td className="px-4 py-3.5">
                    {metrics.sellableYieldPct === undefined ? (
                      <p className="text-xs font-medium text-[var(--muted)]">Pending</p>
                    ) : (
                      <>
                        <p className={`font-mono text-xs font-semibold ${delta !== undefined && delta <= -2 ? "text-[var(--risk)]" : "text-[var(--brand)]"}`}>
                          {metrics.sellableYieldPct}%
                        </p>
                        {delta !== undefined ? (
                          <p className="mt-1 font-mono text-xs text-[var(--muted)]">{delta > 0 ? "+" : ""}{delta} pp</p>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {anomaly ? <AnomalyTag severity={anomaly.severity} /> : <span className="text-xs text-[var(--muted)]">Not analysed</span>}
                  </td>
                  <td className="px-4 py-3.5"><BatchStatusTag status={batch.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

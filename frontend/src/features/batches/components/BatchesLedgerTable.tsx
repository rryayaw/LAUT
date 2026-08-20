import type { BatchLedgerRecord } from "../placeholder/batches-data";
import { BatchStatusTag } from "./BatchStatusTag";

type BatchesLedgerTableProps = {
  batches: BatchLedgerRecord[];
  selectedBatchId: string;
  totalRecordCount: number;
};

export function BatchesLedgerTable({ batches, selectedBatchId, totalRecordCount }: Readonly<BatchesLedgerTableProps>) {
  return (
    <section aria-labelledby="batch-ledger-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-end justify-between gap-6 border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Production ledger</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="batch-ledger-title">Latest reported batches</h2>
        </div>
        <p className="text-right text-xs leading-5 text-[var(--muted)]">Showing {batches.length} of {totalRecordCount} records<br />Across sites and production lines</p>
      </div>
      <div className="overflow-hidden">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-xs font-medium text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">Report context</th>
              <th className="px-4 py-3 font-medium">Site and lines</th>
              <th className="px-4 py-3 font-medium">Input</th>
              <th className="px-4 py-3 font-medium">Yield</th>
              <th className="px-4 py-3 font-medium">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {batches.map((batch) => {
              const isSelected = batch.id === selectedBatchId;
              const yieldDelta = batch.yieldPct !== undefined && batch.baselinePct !== undefined ? batch.yieldPct - batch.baselinePct : undefined;

              return (
                <tr aria-current={isSelected ? "true" : undefined} className={`transition-colors duration-150 ${isSelected ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--surface-subtle)]"}`} key={batch.id}>
                  <td className={`px-5 py-3.5 ${isSelected ? "border-l-2 border-[var(--brand)] pl-[18px]" : ""}`}><p className="font-mono text-xs font-semibold">{batch.id}</p><p className="mt-1 text-xs text-[var(--muted)]">{batch.receivedAt}</p></td>
                  <td className="px-4 py-3.5"><p className="font-medium text-[var(--ink)]">{batch.fishSpecies ?? "Not reported"}</p><p className="mt-1 text-xs text-[var(--muted)]">{batch.source} · {batch.shift}</p></td>
                  <td className="px-4 py-3.5"><p className="text-xs font-medium text-[var(--ink)]">{batch.productionLines.join(", ")}</p><p className="mt-1 text-xs text-[var(--muted)]">{batch.productionSite}</p></td>
                  <td className="px-4 py-3.5 font-mono text-xs font-medium">{batch.inputKg} kg</td>
                  <td className="px-4 py-3.5">{yieldDelta === undefined || batch.yieldPct === undefined ? <p className="text-xs font-medium text-[var(--muted)]">Pending</p> : <><p className={`font-mono text-xs font-semibold ${yieldDelta <= -2 ? "text-[var(--risk)]" : "text-[var(--brand)]"}`}>{batch.yieldPct}%</p><p className="mt-1 font-mono text-xs text-[var(--muted)]">{yieldDelta > 0 ? "+" : ""}{yieldDelta.toFixed(1)} pp</p></>}</td>
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

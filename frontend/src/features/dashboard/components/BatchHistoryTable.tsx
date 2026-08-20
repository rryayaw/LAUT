import type { BatchRecord } from "../placeholder/dashboard-data";
import { StatusTag } from "./StatusTag";

export function BatchHistoryTable({ batches }: Readonly<{ batches: BatchRecord[] }>) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Trusted batch records</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="batch-history-title">Recent production</h2>
        </div>
        <span className="text-xs text-[var(--muted)]">Web and WhatsApp reports</span>
      </div>
      <div className="overflow-hidden">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-[11px] font-medium text-[var(--muted)]">
            <tr><th className="px-5 py-3 font-medium">Batch</th><th className="px-4 py-3 font-medium">Report context</th><th className="px-4 py-3 font-medium">Site and lines</th><th className="px-4 py-3 font-medium">Input</th><th className="px-4 py-3 font-medium">Yield</th><th className="px-4 py-3 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {batches.map((batch) => (
              <tr className="transition-colors duration-150 hover:bg-[var(--surface-subtle)]" key={batch.id}>
                <td className="px-5 py-3.5"><p className="font-mono text-xs font-semibold">{batch.id}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{batch.receivedAt}</p></td>
                <td className="px-4 py-3.5"><p className="font-medium">{batch.product}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{batch.source} · {batch.shift}</p></td>
                <td className="px-4 py-3.5"><p className="text-xs font-medium text-[var(--ink)]">{batch.productionLines.join(", ")}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{batch.productionSite}</p></td>
                <td className="px-4 py-3.5 font-mono text-xs">{batch.inputKg} kg</td>
                <td className={`px-4 py-3.5 font-mono text-xs font-semibold ${batch.yieldPct < batch.baselinePct - 2 ? "text-[var(--risk)]" : "text-[var(--brand)]"}`}>{batch.yieldPct}%</td>
                <td className="px-4 py-3.5"><StatusTag label={batch.status === "investigation_suggested" ? "Review" : batch.status} tone={batch.status === "investigation_suggested" ? "risk" : "neutral"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BatchListItem } from "@/types/domain";

export function BatchHistoryTable({ batches }: Readonly<{ batches: BatchListItem[] }>) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Latest records</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="batch-history-title">Recent production</h2>
        </div>
        <Link className="group inline-flex items-center gap-2 text-xs font-medium text-[var(--brand)]" href="/batches">
          Open ledger
          <ArrowRight aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" size={14} strokeWidth={1.75} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-[11px] font-medium text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Site and lines</th>
              <th className="px-4 py-3 font-medium">Input</th>
              <th className="px-4 py-3 font-medium">Yield</th>
              <th className="px-4 py-3 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {batches.map((batch) => {
              const { metrics, baseline, anomaly } = batch.analysis;
              const isLow =
                metrics.sellableYieldPct !== undefined && baseline
                  ? metrics.sellableYieldPct < baseline.medianYieldPct - 2
                  : false;

              return (
                <tr className="transition-colors duration-150 hover:bg-[var(--surface-subtle)]" key={batch.id}>
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-xs font-semibold">{batch.code}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">{batch.reportedAt}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium">{batch.productSpec}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {batch.source === "whatsapp" ? "WhatsApp" : batch.source === "iot" ? "IoT" : "Web"} · {batch.shift}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs font-medium text-[var(--ink)]">{batch.lineNames.join(", ")}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">{batch.siteName}</p>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs">{batch.quantities.rawInputKg} kg</td>
                  <td className={`px-4 py-3.5 font-mono text-xs font-semibold ${isLow ? "text-[var(--risk)]" : "text-[var(--brand)]"}`}>
                    {metrics.sellableYieldPct === undefined ? "—" : `${metrics.sellableYieldPct}%`}
                  </td>
                  <td className="px-4 py-3.5">
                    {anomaly ? (
                      <Badge tone={anomaly.severity === "abnormal" ? "risk" : anomaly.severity === "watch" ? "neutral" : "brand"}>
                        {anomaly.severity === "abnormal" ? "Abnormal" : anomaly.severity === "watch" ? "Watch" : "Normal"}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-[var(--muted)]">Pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

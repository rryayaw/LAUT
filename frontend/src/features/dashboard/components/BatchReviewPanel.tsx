import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BatchListItem } from "@/types/domain";
import type { LossSlice } from "../types/dashboard.types";

type BatchReviewPanelProps = {
  batch: BatchListItem;
  lossDistribution: LossSlice[];
};

export function BatchReviewPanel({ batch, lossDistribution }: Readonly<BatchReviewPanelProps>) {
  const { metrics, baseline, anomaly } = batch.analysis;
  const difference =
    metrics.sellableYieldPct !== undefined && baseline
      ? Math.round((metrics.sellableYieldPct - baseline.medianYieldPct) * 10) / 10
      : undefined;

  return (
    <article className="col-span-8 border-r border-[var(--line)]">
      <div className="flex items-start justify-between gap-5 border-l-4 border-[var(--risk)] px-5 py-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--risk)]">Requires review</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight" id="priority-review-title">
            {batch.code} finished {difference === undefined ? "below" : `${Math.abs(difference)} pp below`} its comparable yield
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {metrics.massBalance === "balanced"
              ? "Mass balance is complete, so the gap is in how the input was converted rather than in the recording."
              : "Part of the input mass is still unaccounted for, so this result needs confirmation before it is trusted."}
          </p>
        </div>
        {anomaly ? <Badge tone={anomaly.severity === "abnormal" ? "risk" : "neutral"}>
          {anomaly.severity === "abnormal" ? "Abnormal" : "Watch"}
        </Badge> : null}
      </div>

      <dl className="grid grid-cols-5 divide-x divide-[var(--line)] border-t border-[var(--line)]">
        <Definition label="Production site" value={batch.siteName} />
        <Definition label="Lines" value={batch.lineNames.join(", ")} />
        <Definition label="Process tags" value={batch.tagLabels.slice(0, 3).join(", ") || "None"} />
        <Definition label="Shift" value={batch.shift} />
        <Definition label="Supplier" value={batch.supplier ?? "Not reported"} />
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)_15.5rem] border-t border-[var(--line)]">
        <div className="grid grid-cols-4 divide-x divide-[var(--line)]">
          <Quantity label="Input" value={`${batch.quantities.rawInputKg} kg`} />
          <Quantity label="Sellable" value={batch.quantities.sellableOutputKg === undefined ? "—" : `${batch.quantities.sellableOutputKg} kg`} />
          <Quantity label="Yield" tone="risk" value={metrics.sellableYieldPct === undefined ? "—" : `${metrics.sellableYieldPct}%`} />
          <Quantity label="Comparable median" value={baseline ? `${baseline.medianYieldPct}%` : "—"} />
        </div>
        <Link
          className="group flex items-center justify-between gap-3 border-l border-[var(--line)] px-5 text-sm font-medium text-[var(--brand)] transition-colors duration-150 hover:bg-[var(--brand-soft)]"
          href="/investigations"
        >
          Review evidence
          <ArrowRight aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" size={16} strokeWidth={1.75} />
        </Link>
      </div>

      {lossDistribution.length > 0 ? (
        <div className="border-t border-[var(--line)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--muted)]">Where the input mass went</p>
          <div className="mt-3 flex h-4 overflow-hidden bg-[var(--surface-subtle)]">
            {lossDistribution.map((slice) => (
              <span className={`balance-${slice.tone}`} key={slice.name} style={{ width: `${slice.pct}%` }} title={`${slice.name}: ${slice.kg} kg`} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {lossDistribution.map((slice) => (
              <span className="text-xs text-[var(--muted)]" key={slice.name}>
                {slice.name} <span className="font-mono font-semibold text-[var(--ink)]">{slice.pct}%</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {anomaly && anomaly.drivers.length > 0 ? (
        <div className="border-t border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--muted)]">Signals detected</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {anomaly.drivers.map((driver) => (
              <li className="flex gap-2 text-xs leading-5 text-[var(--ink)]" key={driver}>
                <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--risk)]" size={13} strokeWidth={1.75} />
                {driver}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function Definition({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <dt className="text-[11px] font-medium text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-[var(--ink)]" title={value}>{value}</dd>
    </div>
  );
}

function Quantity({ label, tone = "default", value }: Readonly<{ label: string; tone?: "default" | "risk"; value: string }>) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-medium text-[var(--muted)]">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${tone === "risk" ? "text-[var(--risk)]" : "text-[var(--ink)]"}`}>{value}</p>
    </div>
  );
}

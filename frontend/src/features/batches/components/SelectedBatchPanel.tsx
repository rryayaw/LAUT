"use client";

import { Building2, Check, GitBranch, LoaderCircle, MessageCircle, Tags, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BatchListItem, BatchQuantities } from "@/types/domain";
import { AnomalyTag, BatchStatusTag } from "./BatchStatusTag";
import { EditQuantitiesDialog } from "./EditQuantitiesDialog";

type SelectedBatchPanelProps = {
  batch: BatchListItem;
  onConfirm: (batchId: string) => Promise<void>;
  onUpdateQuantities: (batchId: string, quantities: Partial<BatchQuantities>) => Promise<void>;
  isConfirming: boolean;
  isSavingQuantities: boolean;
};

type BalanceRow = { label: string; kg: number; pct: number; tone: string };

function buildBalanceRows(batch: BatchListItem): BalanceRow[] {
  const { quantities: q, analysis } = batch;
  const input = q.rawInputKg;
  const pct = (kg: number) => Math.round((kg / input) * 1000) / 10;

  const rows: BalanceRow[] = [];
  const push = (label: string, kg: number | undefined, tone: string) => {
    if (kg !== undefined && kg > 0) rows.push({ label, kg, pct: pct(kg), tone });
  };

  push("Sellable fillet", q.sellableOutputKg, "sellable");
  push("Normal by-product", q.normalByproductKg, "muted");
  push("Trimming", q.trimmingKg, "normal");
  push("Quality reject", q.qualityRejectKg, "warning");
  push("Spoilage / damage", q.spoilageKg, "warning");
  push("Other documented loss", q.otherLossKg, "normal");

  if (analysis.metrics.unexplainedKg > 0) {
    rows.push({
      label: "Unexplained",
      kg: analysis.metrics.unexplainedKg,
      pct: pct(analysis.metrics.unexplainedKg),
      tone: "warning"
    });
  }

  return rows;
}

export function SelectedBatchPanel({ batch, isConfirming, isSavingQuantities, onConfirm, onUpdateQuantities }: Readonly<SelectedBatchPanelProps>) {
  const { analysis } = batch;
  const { metrics, baseline, anomaly } = analysis;
  const rows = buildBalanceRows(batch);
  const isTrusted = ["confirmed", "analyzed", "closed"].includes(batch.status);
  const delta =
    metrics.sellableYieldPct !== undefined && baseline
      ? Math.round((metrics.sellableYieldPct - baseline.medianYieldPct) * 10) / 10
      : undefined;

  return (
    <aside
      aria-labelledby="selected-batch-title"
      className="sticky top-14 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-y border-[var(--line)] bg-[var(--surface)]"
    >
      <header className="border-b border-[var(--line)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted)]">Selected batch</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-mono text-xl font-semibold tracking-tight" id="selected-batch-title">{batch.code}</h2>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{batch.species} · {batch.productSpec}</p>
          </div>
          <BatchStatusTag status={batch.status} />
        </div>
      </header>

      <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] border-b border-[var(--line)]">
        <Detail label="Shift" value={batch.shift} />
        <Detail label="Supplier" value={batch.supplier ?? "Not reported"} />
        <Detail
          icon={MessageCircle}
          label="Reported via"
          value={batch.source === "whatsapp" ? "WhatsApp" : batch.source === "iot" ? "IoT sensor" : "Web form"}
        />
        <Detail label="Raw input" mono value={`${batch.quantities.rawInputKg} kg`} />
      </dl>

      <section aria-labelledby="production-path-title" className="border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-xs font-medium text-[var(--muted)]" id="production-path-title">Production path</h3>
        <div className="mt-3 flex gap-3">
          <Building2 aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} strokeWidth={1.75} />
          <p className="text-sm font-medium">{batch.siteName}</p>
        </div>
        <div className="mt-3 flex gap-3">
          <GitBranch aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} strokeWidth={1.75} />
          <div>
            <p className="text-sm font-medium">{batch.lineNames.join(" → ")}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {batch.lineNames.length > 1 ? "Batch moved across multiple lines" : "Single production line"}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="process-tags-title" className="border-b border-[var(--line)] px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
          <Tags aria-hidden="true" size={14} strokeWidth={1.75} />
          <h3 id="process-tags-title">Process tags on these lines</h3>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {batch.tagLabels.length > 0 ? (
            batch.tagLabels.map((label) => <Badge key={label} tone="soft">{label}</Badge>)
          ) : (
            <p className="text-xs text-[var(--muted)]">No process tags on the linked lines.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="mass-balance-title" className="border-b border-[var(--line)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium text-[var(--muted)]" id="mass-balance-title">Mass balance</h3>
          <Badge tone={metrics.massBalance === "balanced" ? "brand" : "risk"}>
            {metrics.massBalance === "balanced" ? "Complete" : metrics.massBalance === "incomplete" ? "Incomplete" : "Unexplained mass"}
          </Badge>
        </div>

        {rows.length > 0 ? (
          <>
            <div className="mt-3 flex h-4 overflow-hidden bg-[var(--surface-subtle)]">
              {rows.map((row) => (
                <span className={`balance-${row.tone}`} key={row.label} style={{ width: `${row.pct}%` }} title={`${row.label}: ${row.kg} kg`} />
              ))}
            </div>
            <dl className="mt-3 divide-y divide-[var(--line)]">
              {rows.map((row) => (
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 text-xs" key={row.label}>
                  <dt className="text-[var(--muted)]">{row.label}</dt>
                  <dd className="font-mono">{row.kg} kg</dd>
                  <dd className="font-mono font-semibold">{row.pct}%</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">No output weights reported yet.</p>
        )}
      </section>

      <section aria-labelledby="comparison-title" className="px-5 py-4">
        <h3 className="text-xs font-medium text-[var(--muted)]" id="comparison-title">Comparable performance</h3>

        {metrics.sellableYieldPct === undefined ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Awaiting output weights before yield can be calculated.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Metric label="Sellable yield" tone={delta !== undefined && delta <= -2 ? "risk" : "default"} value={`${metrics.sellableYieldPct}%`} />
            <Metric label="Comparable median" value={baseline ? `${baseline.medianYieldPct}%` : "No baseline"} />
          </div>
        )}

        {baseline ? (
          <p className="mt-3 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--muted)]">
            Compared against {baseline.sampleSize} batches of the same species and product specification.
            {baseline.limitation ? ` ${baseline.limitation}` : ""}
          </p>
        ) : null}

        {anomaly && anomaly.drivers.length > 0 ? (
          <div className="mt-4 border border-[var(--line)] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[var(--muted)]">Signals detected</span>
              <AnomalyTag severity={anomaly.severity} />
            </div>
            <ul className="mt-2 space-y-1.5">
              {anomaly.drivers.map((driver) => (
                <li className="flex gap-2 text-xs leading-5 text-[var(--ink)]" key={driver}>
                  <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--risk)]" size={13} strokeWidth={1.75} />
                  {driver}
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-[var(--line)] pt-2 text-[11px] leading-4 text-[var(--muted)]">
              Signals show what co-occurred with this result. They are not a proven cause.
            </p>
          </div>
        ) : null}

        {!isTrusted ? (
          <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
            <EditQuantitiesDialog batch={batch} isSaving={isSavingQuantities} onSave={onUpdateQuantities} />
            <Button
              className="h-auto w-full rounded-none bg-[var(--brand)] px-3 py-2 text-white shadow-none hover:bg-[var(--brand-strong)]"
              disabled={isConfirming}
              onClick={() => void onConfirm(batch.id)}
              type="button"
            >
              {isConfirming ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> Confirming…</> : <><Check aria-hidden="true" size={15} strokeWidth={1.75} /> Confirm as trusted record</>}
            </Button>
            <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
              Only confirmed batches enter comparable history.
            </p>
          </div>
        ) : null}
      </section>
    </aside>
  );
}

function Detail({
  icon: Icon,
  label,
  mono = false,
  value
}: Readonly<{ icon?: typeof MessageCircle; label: string; mono?: boolean; value: string }>) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
        {Icon ? <Icon aria-hidden="true" size={12} strokeWidth={1.75} /> : null}
        {label}
      </dt>
      <dd className={`mt-1 truncate text-sm font-medium text-[var(--ink)] ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function Metric({ label, tone = "default", value }: Readonly<{ label: string; tone?: "default" | "risk"; value: string }>) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${tone === "risk" ? "text-[var(--risk)]" : "text-[var(--ink)]"}`}>{value}</p>
    </div>
  );
}

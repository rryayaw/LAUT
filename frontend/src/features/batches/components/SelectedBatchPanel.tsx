import { Building2, GitBranch, MessageCircle, Tags } from "lucide-react";
import type { BatchLedgerRecord } from "../placeholder/batches-data";
import { BatchStatusTag } from "./BatchStatusTag";

export function SelectedBatchPanel({ batch }: Readonly<{ batch: BatchLedgerRecord }>) {
  const yieldDelta = batch.yieldPct !== undefined && batch.baselinePct !== undefined ? batch.yieldPct - batch.baselinePct : undefined;

  return (
    <aside aria-labelledby="selected-batch-title" className="sticky top-[5.5rem] border-y border-[var(--line)] bg-[var(--surface)]">
      <header className="border-b border-[var(--line)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted)]">Selected batch</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-mono text-xl font-semibold tracking-tight" id="selected-batch-title">{batch.id}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{batch.fishSpecies ? `${batch.fishSpecies} · ` : ""}Reported {batch.receivedAt}</p>
          </div>
          <BatchStatusTag status={batch.status} />
        </div>
      </header>

      <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] border-b border-[var(--line)]">
        <DetailMetric label="Production site" value={batch.productionSite} />
        <DetailMetric label="Shift" value={batch.shift} />
        <DetailMetric label="Reported via" value={batch.source} icon={MessageCircle} />
        <DetailMetric label="Confirmed input" value={`${batch.inputKg} kg`} mono />
      </dl>

      <section className="border-b border-[var(--line)] px-5 py-4" aria-labelledby="production-path-title">
        <h3 className="text-xs font-medium text-[var(--muted)]" id="production-path-title">Production path</h3>
        <div className="mt-3 flex gap-3">
          <Building2 aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} strokeWidth={1.75} />
          <div><p className="text-sm font-medium">{batch.productionSite}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Production site recorded for this batch</p></div>
        </div>
        <div className="mt-4 flex gap-3">
          <GitBranch aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} strokeWidth={1.75} />
          <div><p className="text-sm font-medium">{batch.productionLines.join(" · ")}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Linked production lines</p></div>
        </div>
      </section>

      <section className="border-b border-[var(--line)] px-5 py-4" aria-labelledby="process-tags-title">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><Tags aria-hidden="true" size={14} strokeWidth={1.75} /><h3 id="process-tags-title">Process tags</h3></div>
        <div className="mt-3 flex flex-wrap gap-2">
          {batch.processTags.length > 0 ? batch.processTags.map((tag) => <span className="border border-[var(--line-strong)] bg-[var(--surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--ink)]" key={tag}>{tag}</span>) : <p className="text-xs text-[var(--muted)]">No process tags recorded yet.</p>}
        </div>
      </section>

      <section className="px-5 py-4" aria-labelledby="batch-balance-title">
        <h3 className="text-xs font-medium text-[var(--muted)]" id="batch-balance-title">Confirmed mass balance</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
          <BalanceMetric label="Sellable fillet" value={formatKg(batch.filletKg)} />
          <BalanceMetric label="By-product" value={formatKg(batch.byProductKg)} />
          <BalanceMetric label="Trimming" value={`${batch.trimmingKg} kg`} />
          <BalanceMetric label="Quality reject" value={`${batch.rejectKg} kg`} tone="risk" />
        </dl>
        <div className="mt-4 border-t border-[var(--line)] pt-4"><p className="text-xs text-[var(--muted)]">Comparable yield</p>{yieldDelta === undefined || batch.yieldPct === undefined ? <p className="mt-1 text-sm font-medium text-[var(--muted)]">Awaiting confirmation</p> : <p className={`mt-1 font-mono text-lg font-semibold ${yieldDelta <= -2 ? "text-[var(--risk)]" : "text-[var(--brand)]"}`}>{batch.yieldPct}% <span className="text-xs font-medium text-[var(--muted)]">({yieldDelta > 0 ? "+" : ""}{yieldDelta.toFixed(1)} pp)</span></p>}</div>
      </section>
    </aside>
  );
}

function DetailMetric({ icon: Icon, label, mono = false, value }: Readonly<{ icon?: typeof MessageCircle; label: string; mono?: boolean; value: string }>) {
  return <div className="min-w-0 px-4 py-3.5"><dt className="flex items-center gap-1.5 text-xs text-[var(--muted)]">{Icon ? <Icon aria-hidden="true" size={12} strokeWidth={1.75} /> : null}{label}</dt><dd className={`mt-1 truncate text-sm font-medium text-[var(--ink)] ${mono ? "font-mono" : ""}`} title={value}>{value}</dd></div>;
}

function BalanceMetric({ label, tone = "default", value }: Readonly<{ label: string; tone?: "default" | "risk"; value: string }>) {
  return <div><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className={`mt-1 font-mono text-sm font-semibold ${tone === "risk" ? "text-[var(--risk)]" : "text-[var(--ink)]"}`}>{value}</dd></div>;
}

function formatKg(value: number | undefined) {
  return value === undefined ? "Not reported" : `${value} kg`;
}

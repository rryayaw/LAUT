import { CirclePause, Gauge, Wrench } from "lucide-react";
import type { ProductionLine } from "../placeholder/production-sites-data";

export function ProductionLinesLedger({ lines }: Readonly<{ lines: ProductionLine[] }>) {
  return (
    <section aria-labelledby="lines-ledger-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)] px-5 py-4"><p className="text-xs font-medium text-[var(--muted)]">Line registry</p><h2 className="mt-1 text-lg font-semibold tracking-tight" id="lines-ledger-title">Production lines</h2></div>
      <table className="w-full border-collapse text-left text-sm"><thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-xs font-medium text-[var(--muted)]"><tr><th className="px-5 py-3 font-medium">Production line</th><th className="px-4 py-3 font-medium">Process tags</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-[var(--line)]">{lines.map((line) => <tr className="transition-colors duration-150 hover:bg-[var(--surface-subtle)]" key={line.id}><td className="px-5 py-4 font-medium text-[var(--ink)]">{line.name}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{line.tags.map((tag) => <span className="border border-[var(--line-strong)] bg-[var(--surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--ink)]" key={tag}>{tag}</span>)}</div></td><td className="px-4 py-4"><LineStatus status={line.status} /></td></tr>)}</tbody></table>
    </section>
  );
}

function LineStatus({ status }: Readonly<{ status: ProductionLine["status"] }>) {
  const Icon = status === "active" ? Gauge : status === "paused" ? CirclePause : Wrench;
  const label = status === "active" ? "Active" : status === "paused" ? "Paused" : "Maintenance";
  const tone = status === "active" ? "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--brand)]" : status === "paused" ? "border-[var(--line-strong)] bg-[var(--surface-subtle)] text-[var(--muted)]" : "border-[var(--risk-line)] bg-[var(--risk-soft)] text-[var(--risk)]";
  return <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium ${tone}`}><Icon aria-hidden="true" size={13} strokeWidth={1.75} />{label}</span>;
}

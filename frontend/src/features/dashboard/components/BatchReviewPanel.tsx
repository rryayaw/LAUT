import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import type { BatchRecord } from "../placeholder/dashboard-data";
import { dashboardSnapshot } from "../placeholder/dashboard-data";
import { InvestigationDialog } from "./InvestigationDialog";
import { StatusTag } from "./StatusTag";

export function BatchReviewPanel({ batch }: Readonly<{ batch: BatchRecord }>) {
  const difference = (batch.yieldPct - batch.baselinePct).toFixed(1);
  const lineSummary = batch.productionLines.join(", ");
  const tagSummary = batch.processTags.join(", ");

  return (
    <article className="col-span-8 border-r border-[var(--line)]">
      <div className="flex items-start justify-between gap-5 border-l-4 border-[var(--risk)] px-5 py-5">
        <div>
          <p className="text-xs font-medium text-[var(--risk)]">Requires review</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight" id="priority-review-title">{batch.id} is below its comparable yield range</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">The confirmed mass balance is complete. Review receiving condition before changing trimming instructions.</p>
        </div>
        <StatusTag label="Investigation suggested" tone="risk" />
      </div>
      <dl className="grid grid-cols-5 divide-x divide-[var(--line)] border-t border-[var(--line)]">
        <Definition label="Production site" value={batch.productionSite} />
        <Definition label="Lines" value={lineSummary} />
        <Definition label="Process tags" value={tagSummary} />
        <Definition label="Shift" value={batch.shift} />
        <Definition label="Reported via" value={batch.source} />
      </dl>
      <div className="grid grid-cols-[minmax(0,1fr)_15.5rem] border-t border-[var(--line)]">
        <div className="grid grid-cols-4 divide-x divide-[var(--line)]">
          <Quantity label="Input" value={`${batch.inputKg} kg`} />
          <Quantity label="Fillet" value={`${batch.filletKg} kg`} />
          <Quantity label="Yield" value={`${batch.yieldPct}%`} tone="risk" />
          <Quantity label="Comparable median" value={`${batch.baselinePct}%`} />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button className="group h-auto justify-between gap-3 rounded-none border-l border-[var(--line)] px-5 py-0 text-left text-[var(--brand)] shadow-none hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]" type="button" variant="ghost">
              Review evidence
              <ArrowRight aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" size={16} strokeWidth={1.75} />
            </Button>
          </SheetTrigger>
          <InvestigationDialog batch={batch} categories={dashboardSnapshot.lossDistribution} difference={difference} evidence={dashboardSnapshot.findings} />
        </Sheet>
      </div>
    </article>
  );
}

function Definition({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="min-w-0 px-5 py-3.5"><dt className="text-[11px] font-medium text-[var(--muted)]">{label}</dt><dd className="mt-1 truncate text-sm font-medium text-[var(--ink)]" title={value}>{value}</dd></div>;
}

function Quantity({ label, value, tone = "default" }: Readonly<{ label: string; value: string; tone?: "default" | "risk" }>) {
  return <div className="px-5 py-4"><p className="text-[11px] font-medium text-[var(--muted)]">{label}</p><p className={`mt-1 font-mono text-lg font-semibold ${tone === "risk" ? "text-[var(--risk)]" : "text-[var(--ink)]"}`}>{value}</p></div>;
}

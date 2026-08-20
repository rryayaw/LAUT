import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AiFinding, BatchRecord, LossCategory } from "../placeholder/dashboard-data";

type InvestigationDialogProps = {
  batch: BatchRecord;
  evidence: AiFinding[];
  categories: LossCategory[];
  difference: string;
};

export function InvestigationDialog({ batch, evidence, categories, difference }: Readonly<InvestigationDialogProps>) {
  const lineSummary = batch.productionLines.join(", ");

  return (
    <SheetContent className="investigation-sheet flex w-[32rem] max-w-[calc(100vw-2rem)] flex-col gap-0 border-l border-[var(--line-strong)] bg-[var(--surface)] p-0 sm:max-w-none" side="right">
        <SheetHeader className="border-b border-[var(--line)] px-6 py-5 text-left">
          <p className="text-xs font-medium text-[var(--risk)]">Suggested investigation</p>
          <SheetTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Check Mina receiving temperature</SheetTitle>
          <SheetDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">Evidence from batch {batch.id} on {lineSummary} at {batch.productionSite}; review before approval.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <section aria-labelledby="evidence-summary-title">
            <h3 className="text-xs font-medium text-[var(--muted)]" id="evidence-summary-title">Evidence summary</h3>
            <div className="mt-3 grid grid-cols-2 border border-[var(--line)]">
              <SheetMetric label="Observed yield" value={`${batch.yieldPct}%`} tone="risk" />
              <SheetMetric label="Comparable median" value={`${batch.baselinePct}%`} />
              <SheetMetric label="Difference" value={`${difference} pp`} tone="risk" />
              <SheetMetric label="Comparable records" value="12" />
            </div>
          </section>

          <section className="mt-7" aria-labelledby="finding-list-title">
            <h3 className="text-xs font-medium text-[var(--muted)]" id="finding-list-title">Grounded findings</h3>
            <div className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {evidence.map((finding) => (
                <article className="py-4" key={finding.title}>
                  <div className="flex gap-3">
                    <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} strokeWidth={1.75} />
                    <div>
                      <h4 className="text-sm font-semibold leading-5">{finding.title}</h4>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{finding.evidence}</p>
                      <p className="mt-2 text-xs font-medium text-[var(--ink)]">{finding.action}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7" aria-labelledby="mass-balance-title">
            <h3 className="text-xs font-medium text-[var(--muted)]" id="mass-balance-title">Confirmed mass balance</h3>
            <div className="mt-3 border border-[var(--line)] p-4">
              <div className="flex h-4 overflow-hidden bg-[var(--surface-subtle)]">
                {categories.map((category) => <span className={`balance-${category.tone}`} key={category.name} style={{ width: `${category.pct}%` }} title={`${category.name}: ${category.kg} kg`} />)}
              </div>
              <dl className="mt-4 divide-y divide-[var(--line)]">
                {categories.map((category) => <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 text-xs" key={category.name}><dt className="text-[var(--muted)]">{category.name}</dt><dd className="font-mono">{category.kg} kg</dd><dd className="font-mono font-semibold">{category.pct}%</dd></div>)}
              </dl>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] bg-[var(--surface-subtle)] px-6 py-4">
          <p className="text-xs leading-5 text-[var(--muted)]">Approval creates a human-owned investigation record.</p>
          <Button className="h-auto shrink-0 cursor-not-allowed rounded-none bg-[var(--brand)] px-3 py-2 text-xs text-white opacity-45 shadow-none hover:bg-[var(--brand)]" disabled title="Approval is not included in this mockup" type="button">
            <Check aria-hidden="true" size={15} strokeWidth={1.75} />
            Approve review
          </Button>
        </div>
    </SheetContent>
  );
}

function SheetMetric({ label, value, tone = "default" }: Readonly<{ label: string; value: string; tone?: "default" | "risk" }>) {
  return <div className="border-b border-[var(--line)] p-3 even:border-l"><p className="text-[10px] font-medium text-[var(--muted)]">{label}</p><p className={`mt-1 font-mono text-base font-semibold ${tone === "risk" ? "text-[var(--risk)]" : "text-[var(--ink)]"}`}>{value}</p></div>;
}

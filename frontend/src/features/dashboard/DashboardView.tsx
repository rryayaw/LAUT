"use client";

import { BatchHistoryTable } from "./components/BatchHistoryTable";
import { BatchReviewPanel } from "./components/BatchReviewPanel";
import { DashboardMetricStrip } from "./components/DashboardMetricStrip";
import { InvestigationQueue } from "./components/InvestigationQueue";
import { ProductionSiteSignalsPanel } from "./components/ProductionSiteSignalsPanel";
import { YieldTrendPanel } from "./components/YieldTrendPanel";
import { dashboardSnapshot } from "./placeholder/dashboard-data";
import { OperationsShell } from "@/components/app/OperationsShell";

export function DashboardView() {
  const data = dashboardSnapshot;

  return (
    <OperationsShell activeArea="dashboard">
      <a className="skip-link" href="#dashboard-content">Skip to dashboard content</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="dashboard-content" tabIndex={-1}>
            <header className="flex items-end justify-between gap-8 border-b border-[var(--line)] pb-5">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">Operations / overview</p>
                <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--ink)]">Today&apos;s production overview</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Confirmed red snapper fillet activity, reviewed against comparable production records.</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-[var(--muted)]">Data current through</p>
                <p className="mt-1 font-mono text-xs font-medium text-[var(--ink)]">{data.updatedAt}</p>
              </div>
            </header>

            <DashboardMetricStrip />

            <section aria-labelledby="priority-review-title" className="mt-6 grid grid-cols-12 border-y border-[var(--line)] bg-[var(--surface)]">
              <BatchReviewPanel batch={data.currentBatch} />
              <InvestigationQueue items={data.investigations} />
            </section>

            <section aria-labelledby="trend-title" className="mt-6 border-y border-[var(--line)] bg-[var(--surface)]">
              <YieldTrendPanel points={data.yieldTrend} />
            </section>

            <section className="mt-6 grid grid-cols-12 gap-6">
              <section aria-labelledby="batch-history-title" className="col-span-8 border-y border-[var(--line)] bg-[var(--surface)]">
                <BatchHistoryTable batches={data.recentBatches} />
              </section>
              <aside aria-labelledby="signals-title" className="col-span-4 border-y border-[var(--line)] bg-[var(--surface)]">
                <ProductionSiteSignalsPanel signals={data.productionSiteSignals} />
              </aside>
            </section>
      </main>
    </OperationsShell>
  );
}

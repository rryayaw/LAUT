"use client";

import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getDashboardOverview } from "./api/dashboard.api";
import { BatchHistoryTable } from "./components/BatchHistoryTable";
import { BatchReviewPanel } from "./components/BatchReviewPanel";
import { DashboardMetricStrip } from "./components/DashboardMetricStrip";
import { InvestigationQueue } from "./components/InvestigationQueue";
import { ProductionSiteSignalsPanel } from "./components/ProductionSiteSignalsPanel";
import { YieldTrendPanel } from "./components/YieldTrendPanel";

export function DashboardView() {
  const { data, error, isLoading } = useAsyncData(() => getDashboardOverview(), []);

  return (
    <OperationsShell>
      <a className="skip-link" href="#dashboard-content">Skip to dashboard content</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="dashboard-content" tabIndex={-1}>
        <PageHeader
          breadcrumb="Operations / overview"
          description={
            data
              ? `${data.activeProcess}, reviewed against comparable production records.`
              : "Loading production overview."
          }
          meta={
            data ? (
              <div className="text-right">
                <p className="text-xs text-[var(--muted)]">Data current through</p>
                <p className="mt-1 font-mono text-xs font-medium text-[var(--ink)]">{data.updatedAt}</p>
              </div>
            ) : undefined
          }
          title="Production overview"
        />

        <AsyncBoundary error={error} isLoading={isLoading}>
          {data ? (
            <>
              <DashboardMetricStrip metrics={data.metrics} />

              {data.priorityBatch ? (
                <section aria-labelledby="priority-review-title" className="mt-6 grid grid-cols-12 border-y border-[var(--line)] bg-[var(--surface)]">
                  <BatchReviewPanel batch={data.priorityBatch} lossDistribution={data.lossDistribution} />
                  <InvestigationQueue items={data.investigations} />
                </section>
              ) : (
                <section className="mt-6 grid grid-cols-12 border-y border-[var(--line)] bg-[var(--surface)]">
                  <div className="col-span-8 border-r border-[var(--line)] px-5 py-8">
                    <h2 className="text-lg font-semibold tracking-tight">No abnormal batches right now</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                      Every analysed batch is within its comparable range. New reports appear here as soon as they are analysed.
                    </p>
                  </div>
                  <InvestigationQueue items={data.investigations} />
                </section>
              )}

              <section aria-labelledby="trend-title" className="mt-6 border-y border-[var(--line)] bg-[var(--surface)]">
                <YieldTrendPanel comparableCount={data.comparableCount} points={data.yieldTrend} />
              </section>

              <section className="mt-6 grid grid-cols-12 gap-6">
                <section aria-labelledby="batch-history-title" className="col-span-8 border-y border-[var(--line)] bg-[var(--surface)]">
                  <BatchHistoryTable batches={data.recentBatches} />
                </section>
                <aside aria-labelledby="signals-title" className="col-span-4 border-y border-[var(--line)] bg-[var(--surface)]">
                  <ProductionSiteSignalsPanel signals={data.productionSiteSignals} />
                </aside>
              </section>
            </>
          ) : null}
        </AsyncBoundary>
      </main>
    </OperationsShell>
  );
}

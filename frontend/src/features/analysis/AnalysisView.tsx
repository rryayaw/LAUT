"use client";

import { useState } from "react";
import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listProductionSites } from "@/features/production-sites/api/production-sites.api";
import { YieldTrendPanel } from "@/features/dashboard/components/YieldTrendPanel";
import { getAnalysisOverview } from "./api/analysis.api";
import type { AnalysisDimension } from "./types/analysis.types";
import { GroupComparisonPanel } from "./components/GroupComparisonPanel";
import { LossTrendPanel } from "./components/LossTrendPanel";
import { YieldDistributionChart } from "./components/YieldDistributionChart";

const ALL = "all";

export function AnalysisView() {
  const [siteFilter, setSiteFilter] = useState(ALL);
  const [dimension, setDimension] = useState<AnalysisDimension>("line");

  const { data, error, isLoading } = useAsyncData(
    () => getAnalysisOverview(siteFilter === ALL ? undefined : siteFilter),
    [siteFilter]
  );
  const { data: sites } = useAsyncData(() => listProductionSites(), []);

  return (
    <OperationsShell>
      <a className="skip-link" href="#analysis-content">Skip to analysis</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="analysis-content" tabIndex={-1}>
        <PageHeader
          breadcrumb="Operations / analysis"
          description="Yield and loss behaviour across confirmed batches, grouped by the operational variables LAUT records."
          meta={
            <div className="w-56">
              <Label className="text-xs font-medium text-[var(--muted)]" htmlFor="analysis-site">Production site</Label>
              <Select onValueChange={setSiteFilter} value={siteFilter}>
                <SelectTrigger
                  className="mt-2 h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]"
                  id="analysis-site"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]">
                  <SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" value={ALL}>All sites</SelectItem>
                  {(sites ?? []).map((site) => (
                    <SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          title="Analysis"
        />

        <div className="mt-6">
          <AsyncBoundary
            emptyMessage="Confirm a few batches to build a comparable baseline."
            emptyTitle="Not enough confirmed batches"
            error={error}
            isEmpty={(data?.trustedBatchCount ?? 0) === 0}
            isLoading={isLoading}
          >
            {data ? (
              <div className="space-y-6">
                <section className="grid grid-cols-4 divide-x divide-[var(--line)] border-y border-[var(--line)] bg-[var(--surface)]">
                  <Summary label="Trusted batches" value={String(data.trustedBatchCount)} />
                  <Summary label="Species" value={data.species} />
                  <Summary label="Specification" value={data.productSpec} />
                  <Summary label="Window" value={data.period} />
                </section>

                <section aria-labelledby="trend-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
                  <YieldTrendPanel
                    comparableCount={data.focusBatch?.analysis.baseline?.sampleSize ?? data.trustedBatchCount}
                    points={data.yieldTrend}
                  />
                </section>

                <section aria-labelledby="comparison-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
                  <GroupComparisonPanel comparisons={data.comparisons} dimension={dimension} onChangeDimension={setDimension} />
                </section>

                <div className="grid grid-cols-2 gap-6">
                  <section aria-labelledby="distribution-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
                    <YieldDistributionChart bins={data.distribution} focusLabel={data.focusBatch?.code} />
                  </section>
                  <section aria-labelledby="loss-trend-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
                    <LossTrendPanel rows={data.lossTrend} />
                  </section>
                </div>
              </div>
            ) : null}
          </AsyncBoundary>
        </div>
      </main>
    </OperationsShell>
  );
}

function Summary({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]" title={value}>{value}</p>
    </div>
  );
}

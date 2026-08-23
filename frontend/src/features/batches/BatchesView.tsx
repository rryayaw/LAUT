"use client";

import { useState } from "react";
import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useWriteAction } from "@/hooks/useWriteAction";
import { WriteErrorBanner } from "@/components/app/WriteErrorBanner";
import type { BatchQuantities, BatchStatus } from "@/types/domain";
import { listProductionSites } from "@/features/production-sites/api/production-sites.api";
import { listProductConfigs } from "@/features/processing-config/api/processing-config.api";
import {
  confirmBatch,
  createBatch,
  listBatches,
  updateBatchQuantities,
  type CreateBatchInput
} from "./api/batches.api";
import { BatchEntryDialog } from "./components/BatchEntryDialog";
import { BatchesLedgerTable } from "./components/BatchesLedgerTable";
import { SelectedBatchPanel } from "./components/SelectedBatchPanel";

const ALL = "all";

const statusFilters: Array<{ label: string; value: string; statuses?: BatchStatus[] }> = [
  { label: "All records", value: ALL },
  { label: "Needs attention", value: "pending", statuses: ["draft", "needs_confirmation"] },
  { label: "Trusted history", value: "trusted", statuses: ["confirmed", "analyzed", "closed"] }
];

const selectClass = "mt-2 h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]";
const selectContentClass = "rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]";
const selectItemClass = "rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]";

export function BatchesView() {
  const [siteFilter, setSiteFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [selectedBatchId, setSelectedBatchId] = useState<string>();

  const statuses = statusFilters.find((filter) => filter.value === statusFilter)?.statuses;

  const { data: batches, error, isLoading, reload } = useAsyncData(
    () => listBatches({ siteId: siteFilter === ALL ? undefined : siteFilter, status: statuses }),
    [siteFilter, statusFilter]
  );
  const { data: sites } = useAsyncData(() => listProductionSites(), []);
  const { data: productConfigs } = useAsyncData(() => listProductConfigs(), []);

  const selectedBatch = batches?.find((batch) => batch.id === selectedBatchId) ?? batches?.[0];

  const create = useWriteAction(async (values: CreateBatchInput) => {
    const batch = await createBatch(values);
    setSelectedBatchId(batch.id);
  }, reload);

  // Confirmation also triggers the backend analysis run, so it can take a moment.
  const confirm = useWriteAction(async (batchId: string) => {
    await confirmBatch(batchId);
  }, reload);

  // Only drafts are editable; the backend rejects a change to a confirmed record.
  const update = useWriteAction(async (batchId: string, quantities: Partial<BatchQuantities>) => {
    await updateBatchQuantities(batchId, quantities);
  }, reload);

  const writeError = create.error ?? confirm.error ?? update.error;

  function dismissWriteError() {
    create.dismissError();
    confirm.dismissError();
    update.dismissError();
  }

  return (
    <OperationsShell>
      <a className="skip-link" href="#batches-content">Skip to batch records</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="batches-content" tabIndex={-1}>
        <PageHeader
          actions={
            <BatchEntryDialog
              onCreateBatch={create.run}
              productConfigs={productConfigs ?? []}
              sites={sites ?? []}
            />
          }
          breadcrumb="Operations / batches"
          description="Every reported batch, the lines it ran on, and how its yield compares with similar historical batches."
          meta={
            <div className="flex items-end gap-3">
              <div className="w-52">
                <Label className="text-xs font-medium text-[var(--muted)]" htmlFor="batch-site-filter">Production site</Label>
                <Select onValueChange={setSiteFilter} value={siteFilter}>
                  <SelectTrigger className={selectClass} id="batch-site-filter"><SelectValue /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem className={selectItemClass} value={ALL}>All sites</SelectItem>
                    {(sites ?? []).map((site) => (
                      <SelectItem className={selectItemClass} key={site.id} value={site.id}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Label className="text-xs font-medium text-[var(--muted)]" htmlFor="batch-status-filter">Record state</Label>
                <Select onValueChange={setStatusFilter} value={statusFilter}>
                  <SelectTrigger className={selectClass} id="batch-status-filter"><SelectValue /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {statusFilters.map((filter) => (
                      <SelectItem className={selectItemClass} key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
          title="Batch records"
        />

        <WriteErrorBanner error={writeError} onDismiss={dismissWriteError} />

        <div className="mt-6">
          <AsyncBoundary
            emptyMessage="No batches match the current filters. Record a batch or widen the filter."
            emptyTitle="No batches to show"
            error={error}
            isEmpty={(batches?.length ?? 0) === 0}
            isLoading={isLoading}
          >
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-8">
                <BatchesLedgerTable
                  batches={batches ?? []}
                  onSelectBatch={setSelectedBatchId}
                  selectedBatchId={selectedBatch?.id}
                />
              </div>
              <div className="col-span-4">
                {selectedBatch ? <SelectedBatchPanel batch={selectedBatch} onConfirm={confirm.run} onUpdateQuantities={update.run} /> : null}
              </div>
            </div>
          </AsyncBoundary>
        </div>
      </main>
    </OperationsShell>
  );
}

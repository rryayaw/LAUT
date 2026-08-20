"use client";

import { useState } from "react";
import { ListFilter } from "lucide-react";
import { OperationsShell } from "@/components/app/OperationsShell";
import { Button } from "@/components/ui/button";
import { BatchesLedgerTable } from "./components/BatchesLedgerTable";
import { BatchEntryDialog } from "./components/BatchEntryDialog";
import type { BatchEntryValues } from "./components/BatchEntryDialog";
import { SelectedBatchPanel } from "./components/SelectedBatchPanel";
import { batchesSnapshot } from "./placeholder/batches-data";
import type { BatchLedgerRecord } from "./placeholder/batches-data";

export function BatchesView() {
  const [batches, setBatches] = useState<BatchLedgerRecord[]>(batchesSnapshot.batches);
  const [selectedBatchId, setSelectedBatchId] = useState(batchesSnapshot.selectedBatchId);
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);

  function createBatch(values: BatchEntryValues) {
    const nextId = Math.max(...batches.map((batch) => Number(batch.id.replace("B-", "")))) + 1;
    const productionLines = values.productionLineContext.split(",").map((line) => line.trim()).filter(Boolean);
    const calculatedYield = values.estimatedFilletKg ? (values.estimatedFilletKg / values.inputKg) * 100 : undefined;

    const batch: BatchLedgerRecord = {
      id: `B-${nextId}`,
      fishSpecies: values.fishSpecies,
      productionSite: values.productionSite,
      productionLines: productionLines.length > 0 ? productionLines : ["Line context pending"],
      processTags: [],
      source: "Web",
      shift: "Unassigned",
      inputKg: values.inputKg,
      filletKg: values.estimatedFilletKg,
      trimmingKg: values.trimmingKg,
      rejectKg: values.qualityRejectKg,
      rejectReason: values.rejectReason,
      deliveryDelay: values.deliveryDelay,
      byProductKg: undefined,
      unexplainedKg: undefined,
      yieldPct: calculatedYield,
      baselinePct: undefined,
      status: "needs_confirmation",
      receivedAt: "Just now"
    };

    setBatches((current) => [batch, ...current]);
    setSelectedBatchId(batch.id);
  }

  if (!selectedBatch) {
    return null;
  }

  return (
    <OperationsShell activeArea="batches">
      <a className="skip-link" href="#batches-content">Skip to batch records</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="batches-content" tabIndex={-1}>
        <header className="flex items-end justify-between gap-8 border-b border-[var(--line)] pb-5">
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">Operations / batches</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--ink)]">Batch records</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Confirmed production history across accessible sites, linked lines, and reported process context.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p className="text-right text-xs leading-5 text-[var(--muted)]">Current local snapshot<br />19 Aug 2026, 09:42</p>
            <Button className="h-auto cursor-not-allowed rounded-none border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--muted)] opacity-65 shadow-none" disabled title="Filters are not included in this mockup" type="button" variant="outline">
              <ListFilter aria-hidden="true" size={15} strokeWidth={1.75} />
              Filter records
            </Button>
            <BatchEntryDialog onCreateBatch={createBatch} />
          </div>
        </header>

        <section className="mt-6 grid grid-cols-12 gap-6">
          <div className="col-span-8"><BatchesLedgerTable batches={batches} selectedBatchId={selectedBatch.id} totalRecordCount={batchesSnapshot.totalTrustedBatches + batches.length - batchesSnapshot.batches.length} /></div>
          <div className="col-span-4"><SelectedBatchPanel batch={selectedBatch} /></div>
        </section>
      </main>
    </OperationsShell>
  );
}

"use client";

import { useState } from "react";
import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { useAsyncData } from "@/hooks/useAsyncData";
import { decideInvestigation, listInvestigations, type InvestigationDecision } from "./api/investigations.api";
import { InvestigationDetail } from "./components/InvestigationDetail";
import { InvestigationList } from "./components/InvestigationList";

export function InvestigationsView() {
  const { data: investigations, error, isLoading, reload } = useAsyncData(() => listInvestigations(), []);
  const [selectedId, setSelectedId] = useState<string>();

  const selected = investigations?.find((item) => item.id === selectedId) ?? investigations?.[0];

  async function handleDecide(investigationId: string, decision: InvestigationDecision) {
    await decideInvestigation(investigationId, decision);
    reload();
  }

  return (
    <OperationsShell>
      <a className="skip-link" href="#investigations-content">Skip to investigations</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="investigations-content" tabIndex={-1}>
        <PageHeader
          breadcrumb="Operations / investigations"
          description="Each recommendation shows the evidence behind it and what that evidence cannot establish. Approving or dismissing is always a human decision."
          title="Investigations"
        />

        <div className="mt-6">
          <AsyncBoundary
            emptyMessage="LAUT recommends an investigation when a confirmed batch falls outside its comparable range."
            emptyTitle="No investigations yet"
            error={error}
            isEmpty={(investigations?.length ?? 0) === 0}
            isLoading={isLoading}
          >
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-7">
                <InvestigationList
                  investigations={investigations ?? []}
                  onSelect={setSelectedId}
                  selectedId={selected?.id}
                />
              </div>
              <div className="col-span-5">
                {selected ? <InvestigationDetail investigation={selected} onDecide={handleDecide} /> : null}
              </div>
            </div>
          </AsyncBoundary>
        </div>
      </main>
    </OperationsShell>
  );
}

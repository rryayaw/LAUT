// Investigation access.
//
// Swap for `/v1/investigations` when the endpoint exists. Decisions here are the
// human-control gate from mastersheet §2.6 — nothing transitions without one.

import type { Investigation, InvestigationOutcome, InvestigationStatus } from "@/types/domain";
import { batches, investigations } from "@/placeholder/mock-db";

export type InvestigationListItem = Investigation & {
  batchCode: string;
  batchYieldPct?: number;
  batchBaselinePct?: number;
};

function expand(investigation: Investigation): InvestigationListItem {
  const batch = batches.find((candidate) => candidate.id === investigation.batchId);
  const input = batch?.quantities.rawInputKg ?? 0;
  const output = batch?.quantities.sellableOutputKg;

  return {
    ...structuredClone(investigation),
    batchCode: batch?.code ?? "Unknown batch",
    batchYieldPct: output !== undefined && input > 0 ? Math.round((output / input) * 1000) / 10 : undefined,
    batchBaselinePct: undefined
  };
}

export async function listInvestigations(): Promise<InvestigationListItem[]> {
  return investigations.map(expand);
}

export async function getInvestigation(investigationId: string): Promise<InvestigationListItem | undefined> {
  const investigation = investigations.find((candidate) => candidate.id === investigationId);
  return investigation ? expand(investigation) : undefined;
}

export type InvestigationDecision = "approve" | "dismiss" | "start";

const nextStatus: Record<InvestigationDecision, InvestigationStatus> = {
  approve: "approved",
  dismiss: "dismissed",
  start: "in_progress"
};

/** A person approves, modifies, or dismisses. LAUT never decides on its own. */
export async function decideInvestigation(
  investigationId: string,
  decision: InvestigationDecision
): Promise<InvestigationListItem> {
  const investigation = investigations.find((candidate) => candidate.id === investigationId);
  if (!investigation) throw new Error(`Investigation ${investigationId} was not found.`);

  investigation.status = nextStatus[decision];
  return expand(investigation);
}

export async function recordOutcome(
  investigationId: string,
  outcome: InvestigationOutcome,
  outcomeNote: string
): Promise<InvestigationListItem> {
  const investigation = investigations.find((candidate) => candidate.id === investigationId);
  if (!investigation) throw new Error(`Investigation ${investigationId} was not found.`);

  investigation.status = "resolved";
  investigation.outcome = outcome;
  investigation.outcomeNote = outcomeNote;
  return expand(investigation);
}

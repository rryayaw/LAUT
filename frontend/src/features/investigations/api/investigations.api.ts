// Investigation access.
//
// Backed by `GET /v1/production-batches/:batchId/analysis`, which returns the
// analysis the backend saved when the batch was confirmed: a deterministic
// assessment plus, when there is enough comparable history, guidance written by
// the model against that assessment alone.
//
// An investigation is raised only where the assessment found a real deviation.
// A batch that sits inside its baseline is not a finding, and is not listed as one.

import type { EvidenceItem, Investigation, InvestigationOutcome, InvestigationStatus } from "@/types/domain";
import { apiRequest } from "@/api/client";
import { cached, invalidateCache } from "@/api/cache";
import { listBatches } from "@/features/batches/api/batches.api";

type Assessment = {
  status: "insufficient_history" | "within_baseline" | "below_baseline" | "above_baseline";
  comparableAverageYieldPercent: number | null;
  yieldDifferencePercentagePoints: number | null;
  anomalyThresholdPercentagePoints: number | null;
  evidenceLimitations: string[];
};

type Guidance = {
  summary: string;
  evidence: Array<{ fact: string; source: "batch" | "comparable_history" | "line_context" }>;
  investigationSteps: Array<{ priority: "low" | "medium" | "high"; action: string; rationale: string }>;
  limitations: string[];
};

type SavedAnalysis = {
  batchId: string;
  assessment: Assessment;
  guidance: Guidance | null;
  evidence: { comparableCount: number; sellableYieldPercent: number };
  aiStatus: "generated" | "not_required" | "not_configured";
  createdAt?: string;
};

export type InvestigationListItem = Investigation & {
  batchCode: string;
  batchYieldPct?: number;
  batchBaselinePct?: number;
};

/**
 * Decisions a person makes on an investigation. The backend has no endpoint for
 * them yet, so they live for the length of the browser session and are lost on
 * reload — the analysis itself is always re-read from the API.
 */
const localDecisions = new Map<string, { status: InvestigationStatus; outcome?: InvestigationOutcome; outcomeNote?: string }>();

const EVIDENCE_KIND: Record<Guidance["evidence"][number]["source"], EvidenceItem["kind"]> = {
  batch: "metric",
  comparable_history: "pattern",
  line_context: "context"
};

const EVIDENCE_LABEL: Record<Guidance["evidence"][number]["source"], string> = {
  batch: "This batch",
  comparable_history: "Comparable history",
  line_context: "Line context"
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function titleFor(assessment: Assessment): string {
  const gap = assessment.yieldDifferencePercentagePoints;
  if (gap === null) return "Yield deviation flagged for review";
  const direction = gap < 0 ? "below" : "above";
  return `Sellable yield ${round(Math.abs(gap))} pp ${direction} the comparable baseline`;
}

/** Comparable depth is the only confidence signal available; it is reported as such. */
function confidenceFor(comparableCount: number): Investigation["confidence"] {
  if (comparableCount >= 8) return "high";
  if (comparableCount >= 5) return "medium";
  return "low";
}

function deterministicSummary(assessment: Assessment): string {
  const gap = assessment.yieldDifferencePercentagePoints;
  const average = assessment.comparableAverageYieldPercent;
  if (gap === null || average === null) return "The saved assessment did not produce a yield comparison.";
  return `Sellable yield differs from the comparable average of ${round(average)}% by ${round(gap)} percentage points, past the ${assessment.anomalyThresholdPercentagePoints} pp threshold. This is a comparison, not a cause.`;
}

function toInvestigation(analysis: SavedAnalysis, batchCode: string, baselinePct?: number): InvestigationListItem {
  const { assessment, guidance } = analysis;
  const steps = [...(guidance?.investigationSteps ?? [])].sort(
    (left, right) => priorityRank(right.priority) - priorityRank(left.priority)
  );
  const decision = localDecisions.get(analysis.batchId);

  return {
    id: analysis.batchId,
    code: `INV-${batchCode}`,
    batchId: analysis.batchId,
    batchCode,
    batchYieldPct: round(analysis.evidence.sellableYieldPercent),
    batchBaselinePct: baselinePct,
    title: titleFor(assessment),
    status: decision?.status ?? "suggested",
    confidence: confidenceFor(analysis.evidence.comparableCount),
    // Assignment and scheduling are not modelled by the API yet.
    owner: "Unassigned",
    due: "No due date",
    createdAt: analysis.createdAt ?? "",
    summary: guidance?.summary ?? deterministicSummary(assessment),
    possibleFactors: [...new Set(steps.map((step) => step.action))],
    recommendedCheck:
      steps[0] === undefined
        ? "Review the batch record against its comparable history before acting."
        : `${steps[0].action} — ${steps[0].rationale}`,
    // The deterministic assessment and the model's own caveats overlap, and saying
    // the same thing twice reads as two separate limitations.
    limitations: [
      ...new Set([
        ...assessment.evidenceLimitations,
        ...(guidance?.limitations ?? []),
        ...(analysis.aiStatus === "not_configured"
          ? ["Written guidance is unavailable because no model is configured; only the deterministic comparison is shown."]
          : [])
      ])
    ],
    evidence: (guidance?.evidence ?? []).map((item) => ({
      kind: EVIDENCE_KIND[item.source],
      label: EVIDENCE_LABEL[item.source],
      detail: item.fact
    })),
    outcome: decision?.outcome,
    outcomeNote: decision?.outcomeNote
  };
}

function priorityRank(priority: "low" | "medium" | "high"): number {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

export async function listInvestigations(): Promise<InvestigationListItem[]> {
  return cached("investigations", async () => {
    const batches = await listBatches();

    // A batch with no saved analysis returns 404; that is a normal state, not an error.
    const analyses = await Promise.all(
      batches.map(async (batch) => {
        const response = await apiRequest<{ analysis: SavedAnalysis } | undefined>(
          `/v1/production-batches/${batch.id}/analysis`,
          { resolveStatuses: [404, 422] }
        );
        return response === undefined ? undefined : { analysis: response.analysis, batch };
      })
    );

    return analyses
      .filter((entry): entry is { analysis: SavedAnalysis; batch: (typeof batches)[number] } => entry !== undefined)
      .filter(
        (entry) =>
          entry.analysis.assessment.status === "below_baseline" || entry.analysis.assessment.status === "above_baseline"
      )
      .map((entry) =>
        toInvestigation(entry.analysis, entry.batch.code, entry.analysis.assessment.comparableAverageYieldPercent ?? undefined)
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  });
}

export async function getInvestigation(investigationId: string): Promise<InvestigationListItem | undefined> {
  const investigations = await listInvestigations();
  return investigations.find((investigation) => investigation.id === investigationId);
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
  const existing = localDecisions.get(investigationId);
  localDecisions.set(investigationId, { ...existing, status: nextStatus[decision] });
  invalidateCache("investigations");

  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error(`Investigation ${investigationId} was not found.`);
  return investigation;
}

export async function recordOutcome(
  investigationId: string,
  outcome: InvestigationOutcome,
  outcomeNote: string
): Promise<InvestigationListItem> {
  localDecisions.set(investigationId, { status: "resolved", outcome, outcomeNote });
  invalidateCache("investigations");

  const investigation = await getInvestigation(investigationId);
  if (!investigation) throw new Error(`Investigation ${investigationId} was not found.`);
  return investigation;
}

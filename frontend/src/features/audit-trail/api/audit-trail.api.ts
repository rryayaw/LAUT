// Audit trail.
//
// Mastersheet §15 wants the full chain: raw input, extraction, correction,
// confirmation, analysis, recommendation, decision, outcome. The backend records
// confirmations in `production_batch_audit_events` and timestamps the batch and its
// saved analysis, so the trail is composed from those three real sources. Nothing
// here is fabricated to fill a gap — a stage the backend does not record simply
// does not appear.

import type { AuditEvent, AuditEventKind } from "@/types/domain";
import { apiRequest, toIsoTimestamp, toText } from "@/api/client";
import { cached } from "@/api/cache";
import { listBatches } from "@/features/batches/api/batches.api";
import { listInvestigations } from "@/features/investigations/api/investigations.api";

type AuditRow = { id: string; event_type: string; metadata: unknown; created_at: string };

export type AuditEventListItem = AuditEvent & {
  subjectLabel: string;
};

export type AuditFilter = {
  kind?: AuditEventKind;
  batchId?: string;
};

const KNOWN_KINDS: AuditEventKind[] = [
  "reported",
  "extracted",
  "clarified",
  "corrected",
  "confirmed",
  "analyzed",
  "recommended",
  "decided",
  "outcome"
];

function toKind(value: string): AuditEventKind {
  return KNOWN_KINDS.includes(value as AuditEventKind) ? (value as AuditEventKind) : "corrected";
}

/** Reads the mass-balance figures the backend stored alongside a confirmation. */
function confirmationDetail(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) return undefined;
  const validation = (metadata as { validation?: { metrics?: Record<string, unknown> } }).validation;
  const metrics = validation?.metrics;
  if (!metrics) return undefined;

  const yieldPercent = typeof metrics.sellableYieldPercent === "number" ? metrics.sellableYieldPercent : undefined;
  const difference = typeof metrics.massBalanceDifferenceKg === "number" ? metrics.massBalanceDifferenceKg : undefined;
  const parts = [
    yieldPercent === undefined ? undefined : `Sellable yield ${Math.round(yieldPercent * 10) / 10}%`,
    difference === undefined ? undefined : `mass-balance difference ${Math.round(difference * 10) / 10} kg`
  ].filter((part): part is string => part !== undefined);

  return parts.length > 0 ? `${parts.join(", ")} at the moment of confirmation.` : undefined;
}

export async function listAuditEvents(filter: AuditFilter = {}): Promise<AuditEventListItem[]> {
  const events = await cached("audit-events", async () => {
    const [batches, investigations] = await Promise.all([listBatches(), listInvestigations()]);

    const perBatch = await Promise.all(
      batches.map(async (batch) => {
        const { auditEvents } = await apiRequest<{ auditEvents: AuditRow[] }>(
          `/v1/production-batches/${batch.id}/audit-events`
        );

        const reported: AuditEventListItem = {
          id: `${batch.id}-reported`,
          batchId: batch.id,
          kind: "reported",
          actor: batch.source === "whatsapp" ? "Operator (WhatsApp)" : "Operator (web)",
          actorType: "user",
          summary: `${batch.code} reported for ${batch.species} · ${batch.productSpec}`,
          detail: `${batch.quantities.rawInputKg} kg raw input on ${batch.productionDate}, ${batch.lineNames.join(" → ") || "no line recorded"}.`,
          at: batch.createdAt,
          subjectLabel: batch.code
        };

        const recorded = auditEvents.map<AuditEventListItem>((row) => ({
          id: row.id,
          batchId: batch.id,
          kind: toKind(row.event_type),
          actor: "Reviewer",
          actorType: "user",
          summary: `${batch.code} ${row.event_type.replace(/_/g, " ")}`,
          detail: confirmationDetail(row.metadata),
          at: toIsoTimestamp(row.created_at) ?? "",
          subjectLabel: batch.code
        }));

        return [reported, ...recorded];
      })
    );

    // The saved analysis carries its own timestamp, which is the analysis stage.
    const analyzed = investigations
      .filter((investigation) => toText(investigation.createdAt) !== undefined)
      .flatMap<AuditEventListItem>((investigation) => [
        {
          id: `${investigation.batchId}-analyzed`,
          batchId: investigation.batchId,
          investigationId: investigation.id,
          kind: "analyzed",
          actor: "LAUT",
          actorType: "system",
          summary: `${investigation.batchCode} compared against ${investigation.confidence}-confidence comparable history`,
          detail: investigation.title,
          at: investigation.createdAt,
          subjectLabel: investigation.batchCode
        },
        {
          id: `${investigation.batchId}-recommended`,
          batchId: investigation.batchId,
          investigationId: investigation.id,
          kind: "recommended",
          actor: "LAUT",
          actorType: "ai",
          summary: `${investigation.code} raised for human review`,
          detail: investigation.recommendedCheck,
          at: investigation.createdAt,
          subjectLabel: investigation.code
        }
      ]);

    return [...perBatch.flat(), ...analyzed].sort((left, right) => right.at.localeCompare(left.at));
  });

  return events
    .filter((event) => (filter.kind ? event.kind === filter.kind : true))
    .filter((event) => (filter.batchId ? event.batchId === filter.batchId : true));
}

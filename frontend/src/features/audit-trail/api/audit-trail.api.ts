// Audit trail.
//
// Records the transitions required by mastersheet §15: raw input, extraction,
// correction, confirmation, analysis, recommendation, decision, outcome.
// Swap for `/v1/audit-events` when the endpoint exists.

import type { AuditEvent, AuditEventKind } from "@/types/domain";
import { auditEvents, batches, investigations } from "@/placeholder/mock-db";

export type AuditEventListItem = AuditEvent & {
  subjectLabel: string;
};

export type AuditFilter = {
  kind?: AuditEventKind;
  batchId?: string;
};

export async function listAuditEvents(filter: AuditFilter = {}): Promise<AuditEventListItem[]> {
  return auditEvents
    .filter((event) => (filter.kind ? event.kind === filter.kind : true))
    .filter((event) => (filter.batchId ? event.batchId === filter.batchId : true))
    .map((event) => {
      const batch = batches.find((candidate) => candidate.id === event.batchId);
      const investigation = investigations.find((candidate) => candidate.id === event.investigationId);
      return {
        ...event,
        subjectLabel: batch?.code ?? investigation?.code ?? "System"
      };
    });
}

// Core LAUT domain entities.
//
// These mirror the shape the backend will eventually return, so feature code can
// keep importing from here unchanged once `src/placeholder/` is deleted.

// ---------------------------------------------------------------------------
// Process tags
// ---------------------------------------------------------------------------

/** Matches the `process_tags` system catalogue in the Supabase migrations. */
export type ProcessTagCode =
  | "receiving"
  | "sorting"
  | "washing"
  | "cutting"
  | "filleting"
  | "deboning"
  | "skinning"
  | "trimming"
  | "grading"
  | "quality_control"
  | "weighing"
  | "packaging"
  | "freezing"
  | "glazing"
  | "cold_storage"
  | "rework"
  | "waste_handling"
  | "other";

export type ProcessTag = {
  code: ProcessTagCode;
  label: string;
  description: string;
};

// ---------------------------------------------------------------------------
// Sites, lines, machines
// ---------------------------------------------------------------------------

export type MachineStatus = "operational" | "maintenance" | "offline";

export type Machine = {
  id: string;
  productionLineId: string;
  name: string;
  model?: string;
  status: MachineStatus;
  /** Free-text operational context. Retrievable for AI explanation, never a measurement. */
  notes?: string;
};

export type ProductionLineStatus = "active" | "paused" | "maintenance";

export type ProductionLine = {
  id: string;
  productionSiteId: string;
  name: string;
  /**
   * The operator's own description of what this line does. Saved verbatim and used
   * as retrievable context for AI explanation and comparable-batch filtering.
   * Never converted into a trusted production measurement.
   */
  description: string;
  status: ProductionLineStatus;
  tagCodes: ProcessTagCode[];
  machines: Machine[];
};

export type ProductionSite = {
  id: string;
  name: string;
  location: string;
  timezone: string;
  lines: ProductionLine[];
};

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

export type BatchStatus =
  | "draft"
  | "needs_confirmation"
  | "confirmed"
  | "analyzed"
  | "closed"
  | "canceled";

export type BatchSource = "web" | "whatsapp" | "iot";

/** Raw reported weights. Every downstream metric is derived from these. */
export type BatchQuantities = {
  rawInputKg: number;
  sellableOutputKg?: number;
  normalByproductKg?: number;
  trimmingKg?: number;
  qualityRejectKg?: number;
  spoilageKg?: number;
  otherLossKg?: number;
};

export type Batch = {
  id: string;
  /** Human-facing identifier, e.g. "B-104". */
  code: string;
  productionSiteId: string;
  /** A batch may move across several lines; order reflects process flow. */
  productionLineIds: string[];
  species: string;
  productSpec: string;
  status: BatchStatus;
  source: BatchSource;
  productionDate: string;
  reportedAt: string;
  shift: string;
  supplier?: string;
  fishSizeCategory?: string;
  deliveryDelayMinutes?: number;
  receivingTempC?: number;
  rejectReason?: string;
  notes?: string;
  quantities: BatchQuantities;
  /** Synthetic/demo records must stay visibly identified. */
  isDemo: boolean;
  /** Original informal report, when the batch arrived over WhatsApp. */
  originalMessage?: string;
};

// ---------------------------------------------------------------------------
// Derived analysis
//
// The backend owns these calculations. The frontend only ever displays them.
// ---------------------------------------------------------------------------

export type MassBalanceStatus = "balanced" | "unexplained" | "incomplete";

export type BatchMetrics = {
  sellableYieldPct?: number;
  trimmingPct?: number;
  rejectPct?: number;
  spoilagePct?: number;
  byproductPct?: number;
  accountedKg: number;
  unexplainedKg: number;
  massBalance: MassBalanceStatus;
};

export type ComparableBaseline = {
  medianYieldPct: number;
  sampleSize: number;
  /** Which batches formed the baseline — shown so the comparison stays auditable. */
  batchCodes: string[];
  /** Stated plainly when lines differ enough that the comparison needs a caveat. */
  limitation?: string;
};

export type AnomalySeverity = "normal" | "watch" | "abnormal";

export type BatchAnomaly = {
  severity: AnomalySeverity;
  score: number;
  /** Which measured signals drove the score. */
  drivers: string[];
};

export type BatchAnalysis = {
  metrics: BatchMetrics;
  baseline?: ComparableBaseline;
  anomaly?: BatchAnomaly;
};

/** What list and detail endpoints will return: the record plus its computed analysis. */
export type AnalyzedBatch = Batch & { analysis: BatchAnalysis };

// ---------------------------------------------------------------------------
// Investigations
// ---------------------------------------------------------------------------

export type InvestigationStatus =
  | "suggested"
  | "approved"
  | "in_progress"
  | "resolved"
  | "dismissed";

export type InvestigationOutcome =
  | "confirmed_factor"
  | "no_issue_found"
  | "insufficient_evidence"
  | "process_changed"
  | "supplier_action"
  | "other";

export type EvidenceKind = "metric" | "pattern" | "context";

export type EvidenceItem = {
  kind: EvidenceKind;
  label: string;
  detail: string;
};

export type Investigation = {
  id: string;
  code: string;
  batchId: string;
  title: string;
  status: InvestigationStatus;
  confidence: "high" | "medium" | "low";
  owner: string;
  due: string;
  createdAt: string;
  /** AI-written, grounded strictly in the evidence list below. */
  summary: string;
  possibleFactors: string[];
  recommendedCheck: string;
  /** What the evidence cannot establish. Always rendered alongside the recommendation. */
  limitations: string[];
  evidence: EvidenceItem[];
  outcome?: InvestigationOutcome;
  outcomeNote?: string;
};

// ---------------------------------------------------------------------------
// Processing configuration
// ---------------------------------------------------------------------------

export type ProductConfig = {
  id: string;
  productionSiteId: string;
  species: string;
  productSpec: string;
  chilledOrFrozen: "chilled" | "frozen";
  expectedYieldPct: number;
  /** Operator-set measurement tolerance. Never inferred by the AI. */
  massBalanceTolerancePct: number;
};

export type LossCategoryTone = "sellable" | "normal" | "warning" | "muted";

export type LossCategoryConfig = {
  code: string;
  label: string;
  description: string;
  tone: LossCategoryTone;
  countsAsLoss: boolean;
};

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export type AuditActorType = "user" | "ai" | "system";

export type AuditEventKind =
  | "reported"
  | "extracted"
  | "clarified"
  | "corrected"
  | "confirmed"
  | "analyzed"
  | "recommended"
  | "decided"
  | "outcome";

export type AuditEvent = {
  id: string;
  batchId?: string;
  investigationId?: string;
  kind: AuditEventKind;
  actor: string;
  actorType: AuditActorType;
  summary: string;
  detail?: string;
  at: string;
};

// ---------------------------------------------------------------------------
// Display-ready records
//
// Endpoints resolve site, line, and tag names before responding, so list views
// never need a second lookup.
// ---------------------------------------------------------------------------

export type BatchContext = {
  siteName: string;
  lineNames: string[];
  tagLabels: string[];
};

export type BatchListItem = AnalyzedBatch & BatchContext;

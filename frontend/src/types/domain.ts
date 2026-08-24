// Core LAUT domain entities.
//
// Feature `api/` modules translate backend responses into these types, so views
// never see snake_case columns, string-encoded numerics, or endpoint shapes.

// ---------------------------------------------------------------------------
// Process tags
// ---------------------------------------------------------------------------

/**
 * A capability-tag code from the backend's `capability_tags` catalogue
 * (`cutting`, `filleting`, `freezing`, …). The catalogue is data rather than a
 * compile-time union, so codes stay open: the backend can seed a new one without
 * a frontend release. Always resolve a code to a label through the catalogue
 * returned by `listProcessTags()`.
 */
export type ProcessTagCode = string;

export type ProcessTag = {
  /** Catalogue row ID. Required when assigning a tag to a production line. */
  id: string;
  code: ProcessTagCode;
  label: string;
  description: string;
};

// ---------------------------------------------------------------------------
// Sites, lines, machines
// ---------------------------------------------------------------------------

export type MachineStatus = "operational" | "maintenance" | "offline";

/**
 * Machine-level records are on the mastersheet roadmap but have no table or
 * endpoint yet, so lines currently come back with an empty machine list.
 */
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

/**
 * The full mastersheet lifecycle. The backend currently persists only `draft` and
 * `confirmed`; the remaining states are accepted here so views need no change as
 * the backend fills them in.
 */
export type BatchStatus =
  | "draft"
  | "needs_confirmation"
  | "confirmed"
  | "analyzed"
  | "closed"
  | "canceled";

export type BatchSource = "web" | "whatsapp" | "import" | "iot";

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
  /** ISO timestamp of when the record was created. Used for ordering the audit trail. */
  createdAt: string;
  /** Relative label derived from `createdAt`, e.g. "3 days ago". */
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
  /** Whether the backend has already persisted an analysis for this batch. */
  hasSavedAnalysis?: boolean;
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

/**
 * A species and specification the site actually processes, which is what LAUT
 * compares batches within. It is declared for each production site; the yield
 * figure remains an observed median, not a target anyone set.
 */
export type ProductConfig = {
  id: string;
  productionSiteId: string;
  species: string;
  productSpec: string;
  chilledOrFrozen: "chilled" | "frozen";
  /** Median sellable yield measured across `sampleSize` confirmed batches. */
  observedMedianYieldPct: number;
  sampleSize: number;
  /** Measurement tolerance applied to the mass balance. Never inferred by the AI. */
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

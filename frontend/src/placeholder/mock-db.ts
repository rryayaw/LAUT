// In-memory stand-in for the Supabase database.
//
// TEMPORARY SCAFFOLDING. Feature `api/` modules read and mutate this the way they
// will later read and mutate the real backend, so the swap is a change of one file
// per feature. Delete this directory once `/v1/*` is live.
//
// Everything here is synthetic and flagged `isDemo: true` (mastersheet guardrail 12).

import type {
  AuditEvent,
  Batch,
  BatchQuantities,
  Investigation,
  LossCategoryConfig,
  ProductConfig,
  ProductionSite
} from "@/types/domain";

// ---------------------------------------------------------------------------
// Sites, lines, machines
// ---------------------------------------------------------------------------

export const productionSites: ProductionSite[] = [
  {
    id: "site-muara-baru",
    name: "Muara Baru Plant",
    location: "Muara Baru, Jakarta Utara",
    timezone: "Asia/Jakarta",
    lines: [
      {
        id: "line-2a",
        productionSiteId: "site-muara-baru",
        name: "Line 2A",
        description:
          "Main manual filleting line for red snapper. Handles whole chilled fish straight from receiving. Two cutting benches feed a shared trimming table. Throughput drops when the raw material arrives soft, because trimmers slow down to protect fillet shape.",
        status: "active",
        tagCodes: ["cutting", "filleting", "trimming", "weighing"],
        machines: [
          { id: "mch-2a-1", productionLineId: "line-2a", name: "Cutting bench 1", model: "Manual station", status: "operational" },
          { id: "mch-2a-2", productionLineId: "line-2a", name: "Cutting bench 2", model: "Manual station", status: "operational" },
          { id: "mch-2a-3", productionLineId: "line-2a", name: "Trimming table", model: "Stainless 3.2m", status: "operational", notes: "Shared between both cutting benches." },
          { id: "mch-2a-4", productionLineId: "line-2a", name: "Platform scale", model: "Kern IFB 60", status: "operational", notes: "Calibrated monthly." }
        ]
      },
      {
        id: "line-1f",
        productionSiteId: "site-muara-baru",
        name: "Line 1F",
        description:
          "Frozen fillet line. Takes trimmed fillets, runs them through the blast freezer, then glazes and packs. Used for export orders. The blast freezer becomes the bottleneck when two batches finish close together.",
        status: "maintenance",
        tagCodes: ["freezing", "glazing", "packaging", "cold_storage"],
        machines: [
          { id: "mch-1f-1", productionLineId: "line-1f", name: "Blast freezer A", model: "Freddo BF-800", status: "maintenance", notes: "Door seal replacement scheduled." },
          { id: "mch-1f-2", productionLineId: "line-1f", name: "Glazing tank", model: "GT-200", status: "operational" },
          { id: "mch-1f-3", productionLineId: "line-1f", name: "Vacuum sealer", model: "Henkelman 200", status: "operational" }
        ]
      },
      {
        id: "line-qc1",
        productionSiteId: "site-muara-baru",
        name: "QC Bench 1",
        description:
          "Quality control and rework station. Every batch passes here before packing. Rejected pieces are graded by reason such as soft flesh, bruising, or cut defect, then either reworked into smaller portions or moved to by-product.",
        status: "active",
        tagCodes: ["quality_control", "grading", "rework"],
        machines: [
          { id: "mch-qc1-1", productionLineId: "line-qc1", name: "Inspection table", model: "Lightbox LT-1", status: "operational" },
          { id: "mch-qc1-2", productionLineId: "line-qc1", name: "Bench scale", model: "Kern PCB 3500", status: "operational" }
        ]
      }
    ]
  },
  {
    id: "site-ancol",
    name: "Ancol Support Site",
    location: "Ancol, Jakarta Utara",
    timezone: "Asia/Jakarta",
    lines: [
      {
        id: "line-3c",
        productionSiteId: "site-ancol",
        name: "Line 3C",
        description:
          "Combined cutting and packing flow for chilled orders with a short lead time. Smaller crew than Muara Baru. Usually runs medium-size fish only.",
        status: "active",
        tagCodes: ["cutting", "filleting", "packaging"],
        machines: [
          { id: "mch-3c-1", productionLineId: "line-3c", name: "Cutting bench", model: "Manual station", status: "operational" },
          { id: "mch-3c-2", productionLineId: "line-3c", name: "Tray sealer", model: "TS-90", status: "operational" }
        ]
      },
      {
        id: "line-pack2",
        productionSiteId: "site-ancol",
        name: "Pack Lane 2",
        description:
          "Secondary packing lane used when Line 3C is at capacity. Final weight check happens here before dispatch.",
        status: "paused",
        tagCodes: ["packaging", "weighing", "quality_control"],
        machines: [
          { id: "mch-p2-1", productionLineId: "line-pack2", name: "Checkweigher", model: "CW-15", status: "offline", notes: "Awaiting recalibration certificate." },
          { id: "mch-p2-2", productionLineId: "line-pack2", name: "Labelling unit", model: "LB-4", status: "operational" }
        ]
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

/**
 * Builds a mass-balanced set of quantities by deriving by-product as the remainder.
 * Keeps the synthetic data arithmetically honest so derived metrics stay believable.
 */
function balanced(
  rawInputKg: number,
  sellableOutputKg: number,
  trimmingKg: number,
  qualityRejectKg: number,
  spoilageKg = 0
): BatchQuantities {
  return {
    rawInputKg,
    sellableOutputKg,
    trimmingKg,
    qualityRejectKg,
    spoilageKg: spoilageKg > 0 ? spoilageKg : undefined,
    normalByproductKg: rawInputKg - sellableOutputKg - trimmingKg - qualityRejectKg - spoilageKg
  };
}

const SNAPPER_CHILLED = { species: "Red snapper", productSpec: "Skinless chilled fillet" };
const SNAPPER_FROZEN = { species: "Red snapper", productSpec: "Skinless frozen fillet" };

export const batches: Batch[] = [
  {
    id: "batch-105", code: "B-105", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a", "line-qc1"],
    ...SNAPPER_CHILLED, status: "needs_confirmation", source: "whatsapp",
    productionDate: "2026-08-19", reportedAt: "19 Aug 2026, 06:41", shift: "Morning",
    supplier: "Mina Segara", fishSizeCategory: "Medium", deliveryDelayMinutes: 140,
    rejectReason: "Soft flesh",
    originalMessage: "Kakap Mina masuk 265 kg. Fillet 118, trimming 20, reject 9 karena lembek. Datang telat lebih dua jam.",
    notes: "By-product weight not yet reported.",
    quantities: { rawInputKg: 265, sellableOutputKg: 118, trimmingKg: 20, qualityRejectKg: 9 },
    isDemo: true
  },
  {
    id: "batch-106", code: "B-106", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a"],
    ...SNAPPER_CHILLED, status: "draft", source: "web",
    productionDate: "2026-08-19", reportedAt: "19 Aug 2026, 09:12", shift: "Morning",
    supplier: "Samudra Biru", fishSizeCategory: "Medium",
    notes: "Output weights pending end of shift.",
    quantities: { rawInputKg: 240 },
    isDemo: true
  },
  {
    id: "batch-104", code: "B-104", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a", "line-qc1"],
    ...SNAPPER_CHILLED, status: "analyzed", source: "whatsapp",
    productionDate: "2026-08-18", reportedAt: "18 Aug 2026, 07:18", shift: "Morning",
    supplier: "Mina Segara", fishSizeCategory: "Medium", deliveryDelayMinutes: 120, receivingTempC: 6.4,
    rejectReason: "Soft flesh",
    originalMessage: "Kakap Mina masuk 250 kg. Fillet 112, trimming 19, reject 8 karena lembek. Datang telat dua jam.",
    quantities: balanced(250, 112, 19, 8), isDemo: true
  },
  {
    id: "batch-103", code: "B-103", productionSiteId: "site-muara-baru", productionLineIds: ["line-1f"],
    ...SNAPPER_FROZEN, status: "analyzed", source: "web",
    productionDate: "2026-08-18", reportedAt: "18 Aug 2026, 21:06", shift: "Night",
    supplier: "Bahari Jaya", fishSizeCategory: "Large", deliveryDelayMinutes: 15, receivingTempC: 3.1,
    quantities: balanced(310, 150, 22, 5), isDemo: true
  },
  {
    id: "batch-102", code: "B-102", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a", "line-qc1"],
    ...SNAPPER_CHILLED, status: "analyzed", source: "whatsapp",
    productionDate: "2026-08-15", reportedAt: "15 Aug 2026, 14:32", shift: "Afternoon",
    supplier: "Mina Segara", fishSizeCategory: "Medium", deliveryDelayMinutes: 95, receivingTempC: 5.8,
    rejectReason: "Soft flesh", quantities: balanced(220, 101, 17, 7), isDemo: true
  },
  {
    id: "batch-101", code: "B-101", productionSiteId: "site-ancol", productionLineIds: ["line-3c"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "web",
    productionDate: "2026-08-14", reportedAt: "14 Aug 2026, 08:11", shift: "Morning",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 10, receivingTempC: 3.4,
    quantities: balanced(280, 136, 20, 4), isDemo: true
  },
  {
    id: "batch-100", code: "B-100", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "whatsapp",
    productionDate: "2026-08-13", reportedAt: "13 Aug 2026, 22:18", shift: "Night",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 20, receivingTempC: 3.6,
    quantities: balanced(260, 124, 21, 6), isDemo: true
  },
  {
    id: "batch-099", code: "B-099", productionSiteId: "site-muara-baru", productionLineIds: ["line-1f"],
    ...SNAPPER_FROZEN, status: "confirmed", source: "web",
    productionDate: "2026-08-12", reportedAt: "12 Aug 2026, 14:40", shift: "Afternoon",
    supplier: "Samudra Biru", fishSizeCategory: "Large", deliveryDelayMinutes: 25, receivingTempC: 3.2,
    quantities: balanced(295, 143, 23, 5), isDemo: true
  },
  {
    id: "batch-098", code: "B-098", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a", "line-qc1"],
    ...SNAPPER_CHILLED, status: "analyzed", source: "whatsapp",
    productionDate: "2026-08-11", reportedAt: "11 Aug 2026, 07:09", shift: "Morning",
    supplier: "Mina Segara", fishSizeCategory: "Small", deliveryDelayMinutes: 105, receivingTempC: 6.1,
    rejectReason: "Soft flesh", quantities: balanced(240, 111, 20, 9), isDemo: true
  },
  {
    id: "batch-097", code: "B-097", productionSiteId: "site-ancol", productionLineIds: ["line-3c", "line-pack2"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "web",
    productionDate: "2026-08-10", reportedAt: "10 Aug 2026, 15:18", shift: "Afternoon",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 15,
    quantities: balanced(270, 129, 18, 5), isDemo: true
  },
  {
    id: "batch-096", code: "B-096", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "whatsapp",
    productionDate: "2026-08-09", reportedAt: "09 Aug 2026, 21:46", shift: "Night",
    supplier: "Mina Segara", fishSizeCategory: "Medium", deliveryDelayMinutes: 85, receivingTempC: 5.2,
    rejectReason: "Bruising", quantities: balanced(245, 114, 23, 7, 4), isDemo: true
  },
  {
    id: "batch-095", code: "B-095", productionSiteId: "site-muara-baru", productionLineIds: ["line-1f"],
    ...SNAPPER_FROZEN, status: "confirmed", source: "web",
    productionDate: "2026-08-08", reportedAt: "08 Aug 2026, 16:22", shift: "Afternoon",
    supplier: "Samudra Biru", fishSizeCategory: "Large", deliveryDelayMinutes: 12,
    quantities: balanced(300, 145, 22, 5), isDemo: true
  },
  {
    id: "batch-094", code: "B-094", productionSiteId: "site-ancol", productionLineIds: ["line-3c"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "web",
    productionDate: "2026-08-07", reportedAt: "07 Aug 2026, 09:03", shift: "Morning",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 18,
    quantities: balanced(265, 128, 19, 4), isDemo: true
  },
  {
    id: "batch-093", code: "B-093", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a", "line-qc1"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "whatsapp",
    productionDate: "2026-08-06", reportedAt: "06 Aug 2026, 07:31", shift: "Morning",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 22,
    quantities: balanced(285, 138, 21, 6), isDemo: true
  },
  {
    id: "batch-092", code: "B-092", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "web",
    productionDate: "2026-08-05", reportedAt: "05 Aug 2026, 13:47", shift: "Afternoon",
    supplier: "Samudra Biru", fishSizeCategory: "Medium", deliveryDelayMinutes: 30,
    quantities: balanced(255, 123, 18, 5), isDemo: true
  },
  {
    id: "batch-091", code: "B-091", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a", "line-qc1"],
    ...SNAPPER_CHILLED, status: "closed", source: "whatsapp",
    productionDate: "2026-08-04", reportedAt: "04 Aug 2026, 06:58", shift: "Morning",
    supplier: "Mina Segara", fishSizeCategory: "Small", deliveryDelayMinutes: 130, receivingTempC: 6.8,
    rejectReason: "Soft flesh", quantities: balanced(230, 106, 19, 8), isDemo: true
  },
  {
    id: "batch-090", code: "B-090", productionSiteId: "site-muara-baru", productionLineIds: ["line-1f"],
    ...SNAPPER_FROZEN, status: "confirmed", source: "web",
    productionDate: "2026-08-03", reportedAt: "03 Aug 2026, 18:14", shift: "Afternoon",
    supplier: "Samudra Biru", fishSizeCategory: "Large", deliveryDelayMinutes: 14,
    quantities: balanced(320, 155, 24, 6), isDemo: true
  },
  {
    id: "batch-089", code: "B-089", productionSiteId: "site-ancol", productionLineIds: ["line-3c"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "web",
    productionDate: "2026-08-02", reportedAt: "02 Aug 2026, 10:26", shift: "Morning",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 16,
    quantities: balanced(275, 133, 20, 5), isDemo: true
  },
  {
    id: "batch-088", code: "B-088", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a", "line-qc1"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "whatsapp",
    productionDate: "2026-08-01", reportedAt: "01 Aug 2026, 07:52", shift: "Morning",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 19,
    quantities: balanced(290, 140, 22, 6), isDemo: true
  },
  {
    id: "batch-087", code: "B-087", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "web",
    productionDate: "2026-07-31", reportedAt: "31 Jul 2026, 15:09", shift: "Afternoon",
    supplier: "Samudra Biru", fishSizeCategory: "Medium", deliveryDelayMinutes: 24,
    quantities: balanced(250, 121, 18, 5), isDemo: true
  },
  {
    id: "batch-086", code: "B-086", productionSiteId: "site-ancol", productionLineIds: ["line-3c", "line-pack2"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "web",
    productionDate: "2026-07-30", reportedAt: "30 Jul 2026, 11:35", shift: "Morning",
    supplier: "Bahari Jaya", fishSizeCategory: "Small", deliveryDelayMinutes: 21,
    quantities: balanced(235, 113, 17, 5), isDemo: true
  },
  {
    id: "batch-085", code: "B-085", productionSiteId: "site-muara-baru", productionLineIds: ["line-1f"],
    ...SNAPPER_FROZEN, status: "confirmed", source: "web",
    productionDate: "2026-07-29", reportedAt: "29 Jul 2026, 17:41", shift: "Afternoon",
    supplier: "Samudra Biru", fishSizeCategory: "Large", deliveryDelayMinutes: 11,
    quantities: balanced(305, 147, 23, 6), isDemo: true
  },
  {
    id: "batch-084", code: "B-084", productionSiteId: "site-muara-baru", productionLineIds: ["line-2a", "line-qc1"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "whatsapp",
    productionDate: "2026-07-28", reportedAt: "28 Jul 2026, 08:20", shift: "Morning",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 17,
    quantities: balanced(260, 126, 19, 5), isDemo: true
  },
  {
    id: "batch-083", code: "B-083", productionSiteId: "site-ancol", productionLineIds: ["line-3c"],
    ...SNAPPER_CHILLED, status: "confirmed", source: "web",
    productionDate: "2026-07-27", reportedAt: "27 Jul 2026, 12:03", shift: "Afternoon",
    supplier: "Bahari Jaya", fishSizeCategory: "Medium", deliveryDelayMinutes: 20,
    quantities: balanced(245, 118, 18, 5), isDemo: true
  }
];

// ---------------------------------------------------------------------------
// Investigations
// ---------------------------------------------------------------------------

export const investigations: Investigation[] = [
  {
    id: "inv-18", code: "INV-18", batchId: "batch-104",
    title: "Record receiving temperature on the next delayed Mina Segara delivery",
    status: "suggested", confidence: "medium", owner: "Rafi Pradana", due: "Next delayed batch",
    createdAt: "18 Aug 2026, 07:44",
    summary:
      "B-104 finished 3.6 pp below the comparable median while quality reject reached 3.2% of input. Four of the five lowest-yield batches this period share the same supplier and a delivery delay above 90 minutes.",
    possibleFactors: [
      "Raw-material condition on delayed deliveries",
      "Cold-chain handling between arrival and first cut",
      "Reject grading consistency at QC Bench 1"
    ],
    recommendedCheck:
      "Record receiving temperature and raw-material condition on the next Mina Segara shipment before changing the filleting process on Line 2A.",
    limitations: [
      "Receiving temperature is missing for two of the four associated batches.",
      "Supplier and delivery delay co-occur in every associated batch, so their effects cannot be separated from this data alone."
    ],
    evidence: [
      { kind: "metric", label: "Sellable yield", detail: "44.8% against a 48.4% comparable median across 12 batches." },
      { kind: "metric", label: "Quality reject", detail: "8 kg, or 3.2% of input, versus a 2.0% median." },
      { kind: "pattern", label: "Supplier association", detail: "4 of the 5 lowest-yield batches list Mina Segara as supplier." },
      { kind: "pattern", label: "Delivery delay", detail: "Every associated batch arrived more than 90 minutes late." },
      { kind: "context", label: "Line 2A description", detail: "Operator notes state throughput drops when raw material arrives soft, as trimmers slow to protect fillet shape." },
      { kind: "context", label: "Reject reason", detail: "Reported as soft flesh on all four associated batches." }
    ]
  },
  {
    id: "inv-16", code: "INV-16", batchId: "batch-098",
    title: "Compare afternoon trimming variance on Line 2A",
    status: "in_progress", confidence: "low", owner: "Dewi Kartasari", due: "20 Aug 2026",
    createdAt: "11 Aug 2026, 09:15",
    summary:
      "Trimming ratio on Line 2A varies between 7.6% and 9.4% of input without a matching change in fish size category. The spread is wider than on the other filleting lines.",
    possibleFactors: ["Trimming technique differences between benches", "Fish size grading at receiving"],
    recommendedCheck: "Weigh trimming separately per cutting bench for three consecutive shifts.",
    limitations: ["Trimming is currently recorded per batch, not per bench, so the comparison cannot isolate a bench yet."],
    evidence: [
      { kind: "metric", label: "Trimming spread", detail: "7.6% to 9.4% of input across 9 Line 2A batches." },
      { kind: "context", label: "Line 2A machines", detail: "Two cutting benches feed one shared trimming table." }
    ]
  },
  {
    id: "inv-14", code: "INV-14", batchId: "batch-091",
    title: "Confirm by-product taxonomy after clarification",
    status: "resolved", confidence: "high", owner: "Bagas Wiratma", due: "Closed 06 Aug 2026",
    createdAt: "04 Aug 2026, 08:10",
    outcome: "process_changed",
    outcomeNote: "By-product is now recorded as a single line covering head, bones, skin, and internal organs. Reporting template updated.",
    summary:
      "B-091 initially reported 97 kg with no category. Clarification confirmed the remainder as normal by-product rather than unexplained loss.",
    possibleFactors: ["Reporting template omitted a by-product field"],
    recommendedCheck: "Confirm the by-product definition with reporting supervisors and update the template.",
    limitations: ["Applies to reporting completeness only; it does not affect measured yield."],
    evidence: [
      { kind: "metric", label: "Unexplained mass at report time", detail: "97 kg, later fully attributed to normal by-product." },
      { kind: "context", label: "Clarification reply", detail: "Supervisor confirmed head, bones, skin, and internal organs." }
    ]
  }
];

// ---------------------------------------------------------------------------
// Processing configuration
// ---------------------------------------------------------------------------

export const productConfigs: ProductConfig[] = [
  {
    id: "cfg-snapper-chilled", productionSiteId: "site-muara-baru",
    species: "Red snapper", productSpec: "Skinless chilled fillet",
    chilledOrFrozen: "chilled", expectedYieldPct: 48.4, massBalanceTolerancePct: 1.5
  },
  {
    id: "cfg-snapper-frozen", productionSiteId: "site-muara-baru",
    species: "Red snapper", productSpec: "Skinless frozen fillet",
    chilledOrFrozen: "frozen", expectedYieldPct: 48.2, massBalanceTolerancePct: 1.5
  },
  {
    id: "cfg-snapper-ancol", productionSiteId: "site-ancol",
    species: "Red snapper", productSpec: "Skinless chilled fillet",
    chilledOrFrozen: "chilled", expectedYieldPct: 48.3, massBalanceTolerancePct: 2
  }
];

export const lossCategories: LossCategoryConfig[] = [
  { code: "sellable", label: "Sellable fillet", description: "Product that meets the configured specification.", tone: "sellable", countsAsLoss: false },
  { code: "byproduct", label: "Normal by-product", description: "Head, bones, skin, and internal organs removed as part of normal processing.", tone: "muted", countsAsLoss: false },
  { code: "trimming", label: "Trimming", description: "Material removed to meet the product specification.", tone: "normal", countsAsLoss: true },
  { code: "reject", label: "Quality reject", description: "Product failing the quality standard, recorded with a reason.", tone: "warning", countsAsLoss: true },
  { code: "spoilage", label: "Spoilage / damage", description: "Product lost to spoilage, damage, or handling.", tone: "warning", countsAsLoss: true },
  { code: "other", label: "Other documented loss", description: "Any other loss the operator records explicitly.", tone: "normal", countsAsLoss: true }
];

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export const auditEvents: AuditEvent[] = [
  { id: "ev-33", batchId: "batch-105", kind: "clarified", actor: "LAUT extraction", actorType: "ai", summary: "Clarification requested for unexplained mass", detail: "118 kg is unaccounted for. Asked whether the remainder is normal by-product.", at: "19 Aug 2026, 06:42" },
  { id: "ev-32", batchId: "batch-105", kind: "extracted", actor: "LAUT extraction", actorType: "ai", summary: "6 fields extracted from the informal report", detail: "Input, sellable output, trimming, reject, reject reason, delivery delay.", at: "19 Aug 2026, 06:41" },
  { id: "ev-31", batchId: "batch-105", kind: "reported", actor: "Rafi Pradana", actorType: "user", summary: "WhatsApp report received for B-105", detail: "Kakap Mina masuk 265 kg. Fillet 118, trimming 20, reject 9 karena lembek.", at: "19 Aug 2026, 06:41" },
  { id: "ev-30", batchId: "batch-106", kind: "reported", actor: "Dewi Kartasari", actorType: "user", summary: "Draft batch B-106 created from the web form", at: "19 Aug 2026, 09:12" },
  { id: "ev-29", investigationId: "inv-18", kind: "recommended", actor: "LAUT analysis", actorType: "ai", summary: "Investigation INV-18 suggested for B-104", detail: "Grounded in 6 evidence items across metrics, patterns, and line context.", at: "18 Aug 2026, 07:44" },
  { id: "ev-28", batchId: "batch-104", kind: "analyzed", actor: "LAUT analysis", actorType: "system", summary: "B-104 analysed against 12 comparable batches", detail: "Sellable yield 44.8%, comparable median 48.4%, mass balance complete.", at: "18 Aug 2026, 07:43" },
  { id: "ev-27", batchId: "batch-104", kind: "confirmed", actor: "Rafi Pradana", actorType: "user", summary: "B-104 confirmed as trusted historical data", at: "18 Aug 2026, 07:40" },
  { id: "ev-26", batchId: "batch-104", kind: "corrected", actor: "Rafi Pradana", actorType: "user", summary: "By-product corrected to 111 kg", detail: "Confirmed as head, bones, skin, and internal organs.", at: "18 Aug 2026, 07:38" },
  { id: "ev-25", batchId: "batch-104", kind: "extracted", actor: "LAUT extraction", actorType: "ai", summary: "5 fields extracted from the WhatsApp report", at: "18 Aug 2026, 07:19" },
  { id: "ev-24", batchId: "batch-104", kind: "reported", actor: "Rafi Pradana", actorType: "user", summary: "WhatsApp report received for B-104", detail: "Kakap Mina masuk 250 kg. Fillet 112, trimming 19, reject 8 karena lembek.", at: "18 Aug 2026, 07:18" },
  { id: "ev-22", investigationId: "inv-16", kind: "decided", actor: "Dewi Kartasari", actorType: "user", summary: "INV-16 approved and moved to in progress", at: "11 Aug 2026, 10:30" },
  { id: "ev-23", investigationId: "inv-14", kind: "outcome", actor: "Bagas Wiratma", actorType: "user", summary: "INV-14 resolved as a process change", detail: "Reporting template updated with a dedicated by-product field.", at: "06 Aug 2026, 14:02" }
];

export type BatchStatus = "needs_confirmation" | "confirmed" | "analyzed" | "investigation_suggested";

export type BatchRecord = {
  id: string;
  product: string;
  supplier: string;
  productionSite: string;
  productionLines: string[];
  processTags: string[];
  shift: string;
  source: "Web" | "WhatsApp";
  inputKg: number;
  filletKg: number;
  trimmingKg: number;
  rejectKg: number;
  byProductKg: number;
  yieldPct: number;
  baselinePct: number;
  status: BatchStatus;
  receivedAt: string;
};

export type YieldPoint = {
  label: string;
  yieldPct: number;
  baselinePct: number;
};

export type LossCategory = {
  name: string;
  kg: number;
  pct: number;
  tone: "sellable" | "normal" | "warning" | "muted";
};

export type AiFinding = {
  title: string;
  evidence: string;
  confidence: "High" | "Medium";
  action: string;
};

export type SupplierSignal = {
  supplier: string;
  batches: number;
  medianYield: number;
  rejectRate: number;
  delayRate: number;
  note: string;
};

export type InvestigationSummary = {
  id: string;
  title: string;
  owner: string;
  status: "Suggested" | "Approved" | "In progress";
  due: string;
};

export const dashboardSnapshot = {
  facilityName: "Teluk Harum Fillet House",
  location: "Muara Baru, Jakarta",
  activeProcess: "Red snapper to chilled fillet",
  period: "Last 14 production days",
  updatedAt: "19 Aug 2026, 09:42",
  whatsappStatus: "Synced 4 min ago",
  metrics: [
    { label: "Confirmed input", value: "4,820 kg", delta: "+312 kg", helper: "Across 21 trusted batches" },
    { label: "Average fillet yield", value: "47.2%", delta: "-1.1 pp", helper: "Against comparable median" },
    { label: "Unexplained mass", value: "16.4 kg", delta: "-8.7 kg", helper: "After confirmation checks" },
    { label: "Open investigations", value: "3", delta: "+1", helper: "One waiting for approval" }
  ],
  yieldTrend: [
    { label: "Aug 06", yieldPct: 48.1, baselinePct: 48.6 },
    { label: "Aug 07", yieldPct: 47.8, baselinePct: 48.5 },
    { label: "Aug 08", yieldPct: 48.9, baselinePct: 48.5 },
    { label: "Aug 10", yieldPct: 46.9, baselinePct: 48.4 },
    { label: "Aug 11", yieldPct: 48.2, baselinePct: 48.4 },
    { label: "Aug 13", yieldPct: 47.4, baselinePct: 48.4 },
    { label: "Aug 15", yieldPct: 45.9, baselinePct: 48.4 },
    { label: "Aug 18", yieldPct: 44.8, baselinePct: 48.4 }
  ] satisfies YieldPoint[],
  currentBatch: {
    id: "B-104",
    product: "Chilled red snapper fillet",
    supplier: "Mina Laut Timur",
    productionSite: "Muara Baru Plant",
    productionLines: ["Line 2A", "QC Bench 1"],
    processTags: ["Cutting", "Quality control"],
    shift: "Morning",
    source: "WhatsApp",
    inputKg: 250,
    filletKg: 112,
    trimmingKg: 19,
    rejectKg: 8,
    byProductKg: 111,
    yieldPct: 44.8,
    baselinePct: 48.4,
    status: "investigation_suggested",
    receivedAt: "Today, 07:18"
  } satisfies BatchRecord,
  lossDistribution: [
    { name: "Sellable fillet", kg: 112, pct: 44.8, tone: "sellable" },
    { name: "By-product", kg: 111, pct: 44.4, tone: "muted" },
    { name: "Trimming", kg: 19, pct: 7.6, tone: "normal" },
    { name: "Quality reject", kg: 8, pct: 3.2, tone: "warning" }
  ] satisfies LossCategory[],
  recentBatches: [
    { id: "B-104", product: "Chilled red snapper fillet", supplier: "Mina Laut Timur", productionSite: "Muara Baru Plant", productionLines: ["Line 2A", "QC Bench 1"], processTags: ["Cutting", "Quality control"], shift: "Morning", source: "WhatsApp", inputKg: 250, filletKg: 112, trimmingKg: 19, rejectKg: 8, byProductKg: 111, yieldPct: 44.8, baselinePct: 48.4, status: "investigation_suggested", receivedAt: "Today, 07:18" },
    { id: "B-103", product: "Frozen red snapper fillet", supplier: "Sari Samudra", productionSite: "Muara Baru Plant", productionLines: ["Line 1F"], processTags: ["Cutting", "Freezing"], shift: "Night", source: "Web", inputKg: 310, filletKg: 150, trimmingKg: 22, rejectKg: 5, byProductKg: 133, yieldPct: 48.4, baselinePct: 48.2, status: "analyzed", receivedAt: "18 Aug, 21:06" },
    { id: "B-102", product: "Chilled red snapper fillet", supplier: "Mina Laut Timur", productionSite: "Muara Baru Plant", productionLines: ["Line 2A", "QC Bench 1"], processTags: ["Cutting", "Quality control"], shift: "Afternoon", source: "WhatsApp", inputKg: 220, filletKg: 101, trimmingKg: 17, rejectKg: 7, byProductKg: 95, yieldPct: 45.9, baselinePct: 48.5, status: "analyzed", receivedAt: "15 Aug, 14:32" },
    { id: "B-101", product: "Chilled red snapper fillet", supplier: "Pasar Ikan Raya", productionSite: "Ancol Support Site", productionLines: ["Line 3C"], processTags: ["Cutting", "Packaging"], shift: "Morning", source: "Web", inputKg: 280, filletKg: 136, trimmingKg: 20, rejectKg: 4, byProductKg: 120, yieldPct: 48.6, baselinePct: 48.3, status: "confirmed", receivedAt: "14 Aug, 08:11" }
  ] satisfies BatchRecord[],
  findings: [
    { title: "Batch B-104 yield is below comparable median", evidence: "44.8% yield versus 48.4% median from 12 comparable red snapper fillet batches.", confidence: "High", action: "Review receiving condition before changing trimming instructions." },
    { title: "Quality reject is elevated on delayed Mina shipments", evidence: "Three low-yield batches this month share Mina Laut Timur and arrival delay above 90 minutes.", confidence: "Medium", action: "Record receiving temperature on the next Mina shipment." },
    { title: "Mass balance completed after WhatsApp clarification", evidence: "111 kg was confirmed as head, bones, skin, and internal organs.", confidence: "High", action: "Keep the original message and confirmation in audit history." }
  ] satisfies AiFinding[],
  supplierSignals: [
    { supplier: "Mina Laut Timur", batches: 8, medianYield: 46.1, rejectRate: 4.8, delayRate: 37.5, note: "Repeated association with soft-flesh reject on delayed arrivals." },
    { supplier: "Sari Samudra", batches: 6, medianYield: 48.7, rejectRate: 1.9, delayRate: 16.7, note: "Stable yield across chilled and frozen specs." },
    { supplier: "Pasar Ikan Raya", batches: 7, medianYield: 48.2, rejectRate: 2.3, delayRate: 14.2, note: "Normal variance; no active recommendation." }
  ] satisfies SupplierSignal[],
  investigations: [
    { id: "INV-18", title: "Check Mina receiving temperature", owner: "Rafi Pradana", status: "Suggested", due: "Next Mina shipment" },
    { id: "INV-16", title: "Compare afternoon trimming variance", owner: "Dewi Kartasari", status: "In progress", due: "20 Aug" },
    { id: "INV-14", title: "Confirm by-product taxonomy update", owner: "Bagas Wiratma", status: "Approved", due: "22 Aug" }
  ] satisfies InvestigationSummary[]
};

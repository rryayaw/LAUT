export type BatchLedgerStatus = "confirmed" | "analyzed" | "needs_confirmation" | "review";

export type BatchLedgerRecord = {
  byProductKg?: number;
  deliveryDelay?: string;
  fishSpecies?: string;
  filletKg?: number;
  id: string;
  inputKg: number;
  processTags: string[];
  productionLines: string[];
  productionSite: string;
  receivedAt: string;
  rejectKg: number;
  rejectReason?: string;
  shift: string;
  source: "Web" | "WhatsApp";
  status: BatchLedgerStatus;
  trimmingKg: number;
  unexplainedKg?: number;
  baselinePct?: number;
  yieldPct?: number;
};

export const batchesSnapshot = {
  activeLines: 5,
  recordsRequiringReview: 3,
  selectedBatchId: "B-104",
  totalTrustedBatches: 28,
  productionSites: 2,
  batches: [
    { id: "B-104", fishSpecies: "Red snapper", productionSite: "Muara Baru Plant", productionLines: ["Line 2A", "QC Bench 1"], processTags: ["Cutting", "Quality control"], source: "WhatsApp", shift: "Morning", inputKg: 250, filletKg: 112, trimmingKg: 19, rejectKg: 8, byProductKg: 111, unexplainedKg: 0, yieldPct: 44.8, baselinePct: 48.4, status: "review", receivedAt: "Today, 07:18" },
    { id: "B-103", fishSpecies: "Red snapper", productionSite: "Muara Baru Plant", productionLines: ["Line 1F"], processTags: ["Cutting", "Freezing"], source: "Web", shift: "Night", inputKg: 310, filletKg: 150, trimmingKg: 22, rejectKg: 5, byProductKg: 133, unexplainedKg: 0, yieldPct: 48.4, baselinePct: 48.2, status: "analyzed", receivedAt: "18 Aug, 21:06" },
    { id: "B-102", fishSpecies: "Red snapper", productionSite: "Muara Baru Plant", productionLines: ["Line 2A", "QC Bench 1"], processTags: ["Cutting", "Quality control"], source: "WhatsApp", shift: "Afternoon", inputKg: 220, filletKg: 101, trimmingKg: 17, rejectKg: 7, byProductKg: 95, unexplainedKg: 0, yieldPct: 45.9, baselinePct: 48.5, status: "analyzed", receivedAt: "15 Aug, 14:32" },
    { id: "B-101", fishSpecies: "Red snapper", productionSite: "Ancol Support Site", productionLines: ["Line 3C"], processTags: ["Cutting", "Packaging"], source: "Web", shift: "Morning", inputKg: 280, filletKg: 136, trimmingKg: 20, rejectKg: 4, byProductKg: 120, unexplainedKg: 0, yieldPct: 48.6, baselinePct: 48.3, status: "confirmed", receivedAt: "14 Aug, 08:11" },
    { id: "B-100", fishSpecies: "Red snapper", productionSite: "Muara Baru Plant", productionLines: ["Line 2A"], processTags: ["Cutting", "Trimming"], source: "WhatsApp", shift: "Night", inputKg: 260, filletKg: 124, trimmingKg: 21, rejectKg: 6, byProductKg: 109, unexplainedKg: 0, yieldPct: 47.7, baselinePct: 48.1, status: "confirmed", receivedAt: "13 Aug, 22:18" },
    { id: "B-099", fishSpecies: "Red snapper", productionSite: "Muara Baru Plant", productionLines: ["Line 1F"], processTags: ["Cutting", "Freezing"], source: "Web", shift: "Afternoon", inputKg: 295, filletKg: 143, trimmingKg: 23, rejectKg: 5, byProductKg: 124, unexplainedKg: 0, yieldPct: 48.5, baselinePct: 48.2, status: "confirmed", receivedAt: "12 Aug, 14:40" },
    { id: "B-098", fishSpecies: "Red snapper", productionSite: "Muara Baru Plant", productionLines: ["Line 2A", "QC Bench 1"], processTags: ["Cutting", "Quality control"], source: "WhatsApp", shift: "Morning", inputKg: 240, filletKg: 111, trimmingKg: 20, rejectKg: 9, byProductKg: 100, unexplainedKg: 0, yieldPct: 46.3, baselinePct: 48.4, status: "review", receivedAt: "11 Aug, 07:09" },
    { id: "B-097", fishSpecies: "Red snapper", productionSite: "Ancol Support Site", productionLines: ["Line 3C", "Pack Lane 2"], processTags: ["Cutting", "Packaging"], source: "Web", shift: "Afternoon", inputKg: 270, filletKg: 129, trimmingKg: 18, rejectKg: 5, byProductKg: 118, unexplainedKg: 0, yieldPct: 47.8, baselinePct: 48.0, status: "needs_confirmation", receivedAt: "10 Aug, 15:18" },
    { id: "B-096", fishSpecies: "Red snapper", productionSite: "Muara Baru Plant", productionLines: ["Line 2A"], processTags: ["Cutting", "Trimming"], source: "WhatsApp", shift: "Night", inputKg: 245, filletKg: 114, trimmingKg: 23, rejectKg: 7, byProductKg: 101, unexplainedKg: 0, yieldPct: 46.5, baselinePct: 48.1, status: "review", receivedAt: "09 Aug, 21:46" }
  ] satisfies BatchLedgerRecord[]
};

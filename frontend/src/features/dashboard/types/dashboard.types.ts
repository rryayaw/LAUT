import type { BatchListItem, Investigation } from "@/types/domain";

export type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  helper: string;
};

export type YieldPoint = {
  /** Production date, unique per point — several batches on one date are aggregated. */
  label: string;
  yieldPct: number;
  baselinePct: number;
  batchCount: number;
};

export type LossSlice = {
  name: string;
  kg: number;
  pct: number;
  tone: "sellable" | "normal" | "warning" | "muted";
};

export type ProductionSiteSignal = {
  productionSite: string;
  batches: number;
  medianYield: number;
  rejectRate: number;
  delayRate: number;
  note: string;
};

export type DashboardOverview = {
  facilityName: string;
  location: string;
  activeProcess: string;
  period: string;
  updatedAt: string;
  metrics: DashboardMetric[];
  yieldTrend: YieldPoint[];
  priorityBatch?: BatchListItem;
  lossDistribution: LossSlice[];
  comparableCount: number;
  recentBatches: BatchListItem[];
  investigations: Investigation[];
  productionSiteSignals: ProductionSiteSignal[];
};

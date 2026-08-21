import { Badge } from "@/components/ui/badge";
import type { AnomalySeverity, BatchStatus } from "@/types/domain";

const statusLabels: Record<BatchStatus, string> = {
  draft: "Draft",
  needs_confirmation: "Needs confirmation",
  confirmed: "Confirmed",
  analyzed: "Analyzed",
  closed: "Closed",
  canceled: "Canceled"
};

export function BatchStatusTag({ status }: Readonly<{ status: BatchStatus }>) {
  const tone = status === "draft" || status === "needs_confirmation" ? "neutral" : "brand";
  return <Badge tone={tone}>{statusLabels[status]}</Badge>;
}

const severityLabels: Record<AnomalySeverity, string> = {
  normal: "Normal",
  watch: "Watch",
  abnormal: "Abnormal"
};

export function AnomalyTag({ severity }: Readonly<{ severity: AnomalySeverity }>) {
  const tone = severity === "abnormal" ? "risk" : severity === "watch" ? "neutral" : "brand";
  return <Badge tone={tone}>{severityLabels[severity]}</Badge>;
}

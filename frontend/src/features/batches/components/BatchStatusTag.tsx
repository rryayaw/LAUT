import type { BatchLedgerStatus } from "../placeholder/batches-data";

const statusLabels: Record<BatchLedgerStatus, string> = {
  analyzed: "Analyzed",
  confirmed: "Confirmed",
  needs_confirmation: "Needs confirmation",
  review: "Requires review"
};

export function BatchStatusTag({ status }: Readonly<{ status: BatchLedgerStatus }>) {
  const isReview = status === "review";
  const isPending = status === "needs_confirmation";

  return <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-[11px] font-medium ${isReview ? "border-[var(--risk-line)] bg-[var(--risk-soft)] text-[var(--risk)]" : isPending ? "border-[var(--line-strong)] bg-[var(--surface-subtle)] text-[var(--muted)]" : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--brand)]"}`}>{statusLabels[status]}</span>;
}

"use client";

import { BarChart3, Check, FileText, GitBranch, LoaderCircle, MapPin, RefreshCw, Repeat, Scale, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EvidenceKind } from "@/types/domain";
import type { InvestigationDecision, InvestigationListItem } from "../api/investigations.api";
import { statusLabels, statusTone } from "./InvestigationList";

const evidenceMeta: Record<EvidenceKind, { icon: LucideIcon; label: string }> = {
  metric: { icon: BarChart3, label: "Measured" },
  pattern: { icon: Repeat, label: "Repeated" },
  context: { icon: FileText, label: "Context" }
};

type InvestigationDetailProps = {
  investigation: InvestigationListItem;
  onDecide: (investigationId: string, decision: InvestigationDecision) => Promise<void>;
  onRefresh: (batchId: string) => Promise<void>;
  isDeciding: boolean;
  isRefreshing: boolean;
};

export function InvestigationDetail({ investigation, isDeciding, isRefreshing, onDecide, onRefresh }: Readonly<InvestigationDetailProps>) {
  const isOpen = investigation.status === "suggested" || investigation.status === "approved";

  return (
    <aside aria-labelledby="investigation-detail-title" className="sticky top-14 flex max-h-[calc(100dvh-5rem)] flex-col border-y border-[var(--line)] bg-[var(--surface)]">
      <header className="border-b border-[var(--line)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold text-[var(--muted)]">
              {investigation.code} · from batch {investigation.batchCode}
            </p>
            <h2 className="mt-1 text-lg font-semibold leading-6 tracking-tight" id="investigation-detail-title">
              {investigation.title}
            </h2>
          </div>
          <Badge tone={statusTone(investigation.status)}>{statusLabels[investigation.status]}</Badge>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section aria-labelledby="summary-title" className="border-b border-[var(--line)] px-5 py-4">
          <h3 className="text-xs font-medium text-[var(--muted)]" id="summary-title">Summary</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{investigation.summary}</p>
        </section>

        <section aria-labelledby="batch-context-title" className="border-b border-[var(--line)] px-5 py-4">
          <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-medium text-[var(--muted)]" id="batch-context-title">Batch context</h3><Button className="h-auto rounded-none px-2 py-1 text-xs" disabled={isRefreshing} onClick={() => void onRefresh(investigation.batchId)} type="button" variant="outline">{isRefreshing ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={13} /> Re-running…</> : <><RefreshCw aria-hidden="true" size={13} /> Re-run analysis</>}</Button></div>
          <div className="mt-3 space-y-3 text-xs"><p className="flex items-center gap-2 text-[var(--ink)]"><MapPin aria-hidden="true" className="text-[var(--brand)]" size={14} />{investigation.siteName}</p><div><p className="flex items-center gap-2 font-medium text-[var(--ink)]"><GitBranch aria-hidden="true" className="text-[var(--brand)]" size={14} />Lines used</p><div className="mt-2 space-y-1.5">{investigation.productionLines.length ? investigation.productionLines.map((line) => <p key={`${line.sequence}-${line.name}`} className="text-[var(--muted)]">{line.sequence ? `${line.sequence}. ` : ""}{line.name}{line.capabilityTags.length ? ` · ${line.capabilityTags.map((tag) => tag.label).join(", ")}` : ""}</p>) : <p className="text-[var(--muted)]">No saved line context — re-run this analysis.</p>}</div></div><div className="grid grid-cols-3 gap-2 border-y border-[var(--line)] py-2 font-mono text-[11px]"><span><Scale aria-hidden="true" className="mr-1 inline text-[var(--brand)]" size={12} />In {investigation.measurements.rawInputKg} kg</span><span>Out {investigation.measurements.sellableOutputKg} kg</span><span>Balance {investigation.measurements.massBalanceDifferenceKg} kg</span></div></div>
        </section>

        <section aria-labelledby="evidence-title" className="border-b border-[var(--line)] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-medium text-[var(--muted)]" id="evidence-title">Supporting evidence</h3>
            <span className="font-mono text-[11px] text-[var(--muted)]">{investigation.evidence.length} items</span>
          </div>
          <div className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {investigation.evidence.map((item, index) => {
              const meta = evidenceMeta[item.kind];
              const Icon = meta.icon;
              return (
                <article className="flex gap-3 py-3" key={index}>
                  <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={15} strokeWidth={1.75} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold leading-5">{item.label}</h4>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">{meta.label}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.detail}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="checks-title" className="border-b border-[var(--line)] px-5 py-4">
          <h3 className="text-xs font-medium text-[var(--muted)]" id="checks-title">Suggested checks</h3>
          <div className="mt-3 space-y-3">{investigation.suggestedChecks.map((check) => <article className="border border-[var(--line)] p-3" key={check.id}><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium leading-5 text-[var(--ink)]">{check.action}</p><Badge tone={check.priority === "high" ? "risk" : "soft"}>{check.priority}</Badge></div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{check.rationale}</p>{check.relatedLines.length || check.relatedTags.length ? <p className="mt-2 text-[11px] text-[var(--brand-strong)]">{[...check.relatedLines, ...check.relatedTags].join(" · ")}</p> : null}{check.basedOn.length ? <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">Based on: {check.basedOn.join("; ")}</p> : null}</article>)}</div>
        </section>

        <section aria-labelledby="recommendation-title" className="border-b border-[var(--line)] bg-[var(--brand-soft)] px-5 py-4">
          <h3 className="text-xs font-medium text-[var(--brand-strong)]" id="recommendation-title">Recommended next check</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">{investigation.recommendedCheck}</p>
        </section>


        {investigation.outcome ? (
          <section aria-labelledby="outcome-title" className="px-5 py-4">
            <h3 className="text-xs font-medium text-[var(--muted)]" id="outcome-title">Recorded outcome</h3>
            <p className="mt-2 text-sm font-medium capitalize text-[var(--ink)]">
              {investigation.outcome.replace(/_/g, " ")}
            </p>
            {investigation.outcomeNote ? (
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{investigation.outcomeNote}</p>
            ) : null}
          </section>
        ) : null}
      </div>

      {isOpen ? (
        <div className="border-t border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-4">
          <p className="text-xs leading-5 text-[var(--muted)]">
            A person decides. LAUT never acts on a recommendation by itself.
          </p>
          <div className="mt-3 flex gap-3">
            {investigation.status === "suggested" ? (
              <>
                <Button
                  className="h-auto flex-1 rounded-none bg-[var(--brand)] px-3 py-2 text-xs text-white shadow-none hover:bg-[var(--brand-strong)]"
                  disabled={isDeciding}
                  onClick={() => void onDecide(investigation.id, "approve")}
                  type="button"
                >
                  {isDeciding ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> Saving…</> : <><Check aria-hidden="true" size={14} strokeWidth={1.75} /> Approve</>}
                </Button>
                <Button
                  className="h-auto flex-1 rounded-none border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)] shadow-none hover:bg-[var(--surface-pressed)] hover:text-[var(--ink)]"
                  disabled={isDeciding}
                  onClick={() => void onDecide(investigation.id, "dismiss")}
                  type="button"
                  variant="outline"
                >
                  {isDeciding ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> Saving…</> : <><X aria-hidden="true" size={14} strokeWidth={1.75} /> Dismiss</>}
                </Button>
              </>
            ) : (
              <Button
                className="h-auto w-full rounded-none bg-[var(--brand)] px-3 py-2 text-xs text-white shadow-none hover:bg-[var(--brand-strong)]"
                disabled={isDeciding}
                onClick={() => void onDecide(investigation.id, "start")}
                type="button"
              >
                {isDeciding ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> Saving…</> : "Mark as in progress"}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

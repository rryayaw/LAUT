"use client";

import { Badge } from "@/components/ui/badge";
import type { Investigation } from "@/types/domain";
import type { InvestigationListItem } from "../api/investigations.api";

export const statusLabels: Record<Investigation["status"], string> = {
  suggested: "Suggested",
  approved: "Approved",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed"
};

export function statusTone(status: Investigation["status"]) {
  if (status === "suggested") return "risk" as const;
  if (status === "resolved" || status === "dismissed") return "neutral" as const;
  return "brand" as const;
}

type InvestigationListProps = {
  investigations: InvestigationListItem[];
  selectedId?: string;
  onSelect: (investigationId: string) => void;
};

export function InvestigationList({ investigations, onSelect, selectedId }: Readonly<InvestigationListProps>) {
  return (
    <section aria-labelledby="investigation-list-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-end justify-between gap-6 border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Human-owned queue</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight" id="investigation-list-title">Investigations</h2>
        </div>
        <p className="text-right text-xs leading-5 text-[var(--muted)]">
          {investigations.filter((item) => item.status === "suggested").length} awaiting a decision
        </p>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {investigations.map((investigation) => {
          const isSelected = investigation.id === selectedId;
          return (
            <article
              className={`cursor-pointer px-5 py-4 transition-colors duration-150 ${isSelected ? "border-l-2 border-[var(--brand)] bg-[var(--brand-soft)] pl-[18px]" : "hover:bg-[var(--surface-subtle)]"}`}
              key={investigation.id}
              onClick={() => onSelect(investigation.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-[var(--muted)]">
                    {investigation.code} · from {investigation.batchCode}
                  </p>
                  <button
                    className="mt-1 text-left text-sm font-semibold leading-5 text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                    onClick={() => onSelect(investigation.id)}
                    type="button"
                  >
                    {investigation.title}
                  </button>
                </div>
                <Badge tone={statusTone(investigation.status)}>{statusLabels[investigation.status]}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{investigation.summary}</p>
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                {investigation.owner} · {investigation.due} · {investigation.confidence} confidence
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

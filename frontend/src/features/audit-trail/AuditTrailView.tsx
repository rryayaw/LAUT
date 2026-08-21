"use client";

import { useState } from "react";
import { Bot, CircleUser, Cog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/useAsyncData";
import type { AuditActorType, AuditEventKind } from "@/types/domain";
import { listAuditEvents } from "./api/audit-trail.api";

const ALL = "all";

const kindLabels: Record<AuditEventKind, string> = {
  reported: "Reported",
  extracted: "Extracted",
  clarified: "Clarified",
  corrected: "Corrected",
  confirmed: "Confirmed",
  analyzed: "Analysed",
  recommended: "Recommended",
  decided: "Decided",
  outcome: "Outcome"
};

const actorIcons: Record<AuditActorType, LucideIcon> = {
  user: CircleUser,
  ai: Bot,
  system: Cog
};

export function AuditTrailView() {
  const [kindFilter, setKindFilter] = useState(ALL);

  const { data: events, error, isLoading } = useAsyncData(
    () => listAuditEvents(kindFilter === ALL ? {} : { kind: kindFilter as AuditEventKind }),
    [kindFilter]
  );

  return (
    <OperationsShell>
      <a className="skip-link" href="#audit-content">Skip to audit trail</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="audit-content" tabIndex={-1}>
        <PageHeader
          breadcrumb="Operations / audit trail"
          description="Every transition from raw report through extraction, correction, confirmation, analysis, and human decision."
          meta={
            <div className="w-52">
              <Label className="text-xs font-medium text-[var(--muted)]" htmlFor="audit-kind">Event type</Label>
              <Select onValueChange={setKindFilter} value={kindFilter}>
                <SelectTrigger
                  className="mt-2 h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]"
                  id="audit-kind"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]">
                  <SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" value={ALL}>All events</SelectItem>
                  {(Object.keys(kindLabels) as AuditEventKind[]).map((kind) => (
                    <SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" key={kind} value={kind}>
                      {kindLabels[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          title="Audit trail"
        />

        <div className="mt-6">
          <AsyncBoundary
            emptyMessage="No events match this filter."
            emptyTitle="Nothing recorded"
            error={error}
            isEmpty={(events?.length ?? 0) === 0}
            isLoading={isLoading}
          >
            <section aria-labelledby="audit-list-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
              <div className="border-b border-[var(--line)] px-5 py-4">
                <p className="text-xs font-medium text-[var(--muted)]">Provenance</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight" id="audit-list-title">Recorded transitions</h2>
              </div>
              <ol className="divide-y divide-[var(--line)]">
                {(events ?? []).map((event) => {
                  const Icon = actorIcons[event.actorType];
                  return (
                    <li className="flex gap-4 px-5 py-4" key={event.id}>
                      <div className="flex w-28 shrink-0 flex-col gap-2">
                        <Badge tone={event.actorType === "ai" ? "soft" : "neutral"}>{kindLabels[event.kind]}</Badge>
                        <span className="font-mono text-[11px] text-[var(--muted)]">{event.subjectLabel}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-5 text-[var(--ink)]">{event.summary}</p>
                        {event.detail ? (
                          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{event.detail}</p>
                        ) : null}
                        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                          <Icon aria-hidden="true" size={12} strokeWidth={1.75} />
                          {event.actor}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-[11px] text-[var(--muted)]">{event.at}</p>
                    </li>
                  );
                })}
              </ol>
              <p className="border-t border-[var(--line)] px-5 py-3 text-[11px] leading-4 text-[var(--muted)]">
                AI-authored entries are labelled so the boundary between what was measured and what was
                interpreted stays visible.
              </p>
            </section>
          </AsyncBoundary>
        </div>
      </main>
    </OperationsShell>
  );
}

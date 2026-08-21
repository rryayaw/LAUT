"use client";

import { Cog, FileText, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Machine, ProcessTag, ProductionLine } from "@/types/domain";
import type { CreateMachineInput } from "../api/production-sites.api";
import { AddMachineDialog } from "./ProductionSiteDialogs";

type ProductionLinePanelProps = {
  line: ProductionLine;
  processTags: ProcessTag[];
  onAddMachine: (values: CreateMachineInput) => void;
};

export function ProductionLinePanel({ line, onAddMachine, processTags }: Readonly<ProductionLinePanelProps>) {
  return (
    <aside aria-labelledby="line-panel-title" className="sticky top-14 border-y border-[var(--line)] bg-[var(--surface)]">
      <header className="border-b border-[var(--line)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted)]">Selected line</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight" id="line-panel-title">{line.name}</h2>
      </header>

      <section aria-labelledby="line-context-title" className="border-b border-[var(--line)] px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
          <FileText aria-hidden="true" size={14} strokeWidth={1.75} />
          <h3 id="line-context-title">Saved operational context</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{line.description}</p>
        <p className="mt-3 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--muted)]">
          Retrievable as supporting context for AI explanation. It is never converted into a production
          measurement without confirmation.
        </p>
      </section>

      <section aria-labelledby="line-tags-title" className="border-b border-[var(--line)] px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
          <Tags aria-hidden="true" size={14} strokeWidth={1.75} />
          <h3 id="line-tags-title">Process tags</h3>
        </div>
        <div className="mt-3 space-y-2">
          {line.tagCodes.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No process tags attached to this line yet.</p>
          ) : (
            line.tagCodes.map((code) => {
              const tag = processTags.find((candidate) => candidate.code === code);
              if (!tag) return null;
              return (
                <div className="flex gap-3" key={code}>
                  <Badge tone="soft">{tag.label}</Badge>
                  <p className="min-w-0 flex-1 text-xs leading-5 text-[var(--muted)]">{tag.description}</p>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section aria-labelledby="line-machines-title" className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <Cog aria-hidden="true" size={14} strokeWidth={1.75} />
            <h3 id="line-machines-title">Machines</h3>
          </div>
          <AddMachineDialog lineName={line.name} onAddMachine={onAddMachine} />
        </div>
        <div className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {line.machines.length === 0 ? (
            <p className="py-4 text-xs text-[var(--muted)]">No machines recorded on this line yet.</p>
          ) : (
            line.machines.map((machine) => <MachineRow key={machine.id} machine={machine} />)
          )}
        </div>
      </section>
    </aside>
  );
}

function MachineRow({ machine }: Readonly<{ machine: Machine }>) {
  const tone = machine.status === "operational" ? "brand" : machine.status === "maintenance" ? "neutral" : "risk";
  const label = machine.status === "operational" ? "Operational" : machine.status === "maintenance" ? "Maintenance" : "Offline";

  return (
    <article className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--ink)]">{machine.name}</p>
          {machine.model ? <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{machine.model}</p> : null}
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      {machine.notes ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{machine.notes}</p> : null}
    </article>
  );
}

"use client";

import { CirclePause, Cog, Gauge, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProcessTag, ProductionLine } from "@/types/domain";

type ProductionLinesLedgerProps = {
  lines: ProductionLine[];
  processTags: ProcessTag[];
  selectedLineId?: string;
  onSelectLine: (lineId: string) => void;
};

export function ProductionLinesLedger({ lines, onSelectLine, processTags, selectedLineId }: Readonly<ProductionLinesLedgerProps>) {
  const labelOf = (code: string) => processTags.find((tag) => tag.code === code)?.label ?? code;

  return (
    <section aria-labelledby="lines-ledger-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <p className="text-xs font-medium text-[var(--muted)]">Line registry</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight" id="lines-ledger-title">Production lines</h2>
      </div>
      {lines.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">
          No production lines yet. Add the first line to describe what this site does.
        </p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-xs font-medium text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Production line</th>
              <th className="px-4 py-3 font-medium">Process tags</th>
              <th className="px-4 py-3 font-medium">Machines</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {lines.map((line) => {
              const isSelected = line.id === selectedLineId;
              return (
                <tr
                  aria-current={isSelected ? "true" : undefined}
                  className={`cursor-pointer transition-colors duration-150 ${isSelected ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--surface-subtle)]"}`}
                  key={line.id}
                  onClick={() => onSelectLine(line.id)}
                >
                  <td className={`px-5 py-4 ${isSelected ? "border-l-2 border-[var(--brand)] pl-[18px]" : ""}`}>
                    <button
                      className="text-left font-medium text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                      onClick={() => onSelectLine(line.id)}
                      type="button"
                    >
                      {line.name}
                    </button>
                    <p className="mt-1 line-clamp-1 max-w-md text-xs text-[var(--muted)]">{line.description}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {line.tagCodes.length === 0 ? (
                        <span className="text-xs text-[var(--muted)]">No tags</span>
                      ) : (
                        line.tagCodes.map((code) => <Badge key={code} tone="soft">{labelOf(code)}</Badge>)
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--muted)]">
                      <Cog aria-hidden="true" size={13} strokeWidth={1.75} />
                      {line.machines.length}
                    </span>
                  </td>
                  <td className="px-4 py-4"><LineStatus status={line.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function LineStatus({ status }: Readonly<{ status: ProductionLine["status"] }>) {
  const Icon = status === "active" ? Gauge : status === "paused" ? CirclePause : Wrench;
  const label = status === "active" ? "Active" : status === "paused" ? "Paused" : "Maintenance";
  const tone = status === "active" ? "brand" : status === "paused" ? "neutral" : "risk";

  return (
    <Badge tone={tone}>
      <Icon aria-hidden="true" size={13} strokeWidth={1.75} />
      {label}
    </Badge>
  );
}

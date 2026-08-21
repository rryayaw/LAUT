import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Investigation } from "@/types/domain";

const statusLabels: Record<Investigation["status"], string> = {
  suggested: "Suggested",
  approved: "Approved",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed"
};

export function InvestigationQueue({ items }: Readonly<{ items: Investigation[] }>) {
  return (
    <aside aria-labelledby="investigation-queue-title" className="col-span-4">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Queue</p>
          <h2 className="mt-1 text-base font-semibold" id="investigation-queue-title">Open investigations</h2>
        </div>
        <span className="font-mono text-sm font-semibold text-[var(--ink)]">{items.length}</span>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-xs text-[var(--muted)]">No investigations are waiting for a decision.</p>
        ) : (
          items.map((item) => (
            <article className="px-5 py-4" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-[var(--muted)]">{item.code}</p>
                  <h3 className="mt-1 text-sm font-semibold leading-5 text-[var(--ink)]">{item.title}</h3>
                </div>
                <Badge tone={item.status === "suggested" ? "risk" : "neutral"}>{statusLabels[item.status]}</Badge>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">{item.owner} · {item.due}</p>
            </article>
          ))
        )}
      </div>
      <div className="border-t border-[var(--line)] px-5 py-3">
        <Link className="group inline-flex items-center gap-2 text-xs font-medium text-[var(--brand)]" href="/investigations">
          Review all investigations
          <ArrowRight aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" size={14} strokeWidth={1.75} />
        </Link>
      </div>
    </aside>
  );
}

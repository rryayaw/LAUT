import type { InvestigationSummary } from "../placeholder/dashboard-data";
import { StatusTag } from "./StatusTag";

export function InvestigationQueue({ items }: Readonly<{ items: InvestigationSummary[] }>) {
  return (
    <aside className="col-span-4" aria-labelledby="investigation-queue-title">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">Queue</p>
          <h2 className="mt-1 text-base font-semibold" id="investigation-queue-title">Open investigations</h2>
        </div>
        <span className="font-mono text-sm font-semibold text-[var(--ink)]">{items.length}</span>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {items.map((item) => (
          <article className="px-5 py-4" key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold text-[var(--muted)]">{item.id}</p>
                <h3 className="mt-1 text-sm font-semibold leading-5 text-[var(--ink)]">{item.title}</h3>
              </div>
              <StatusTag label={item.status} tone={item.status === "Suggested" ? "risk" : "neutral"} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{item.owner} · {item.due}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}

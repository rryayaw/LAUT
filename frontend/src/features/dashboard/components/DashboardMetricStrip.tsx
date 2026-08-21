import type { DashboardMetric } from "../types/dashboard.types";

export function DashboardMetricStrip({ metrics }: Readonly<{ metrics: DashboardMetric[] }>) {
  return (
    <section aria-label="Production summary" className="grid grid-cols-4 divide-x divide-[var(--line)] border-b border-[var(--line)]">
      {metrics.map((metric) => (
        <article className="py-5 pr-5 first:pl-0 last:pr-0 [&:not(:first-child)]:pl-5" key={metric.label}>
          <p className="text-xs font-medium text-[var(--muted)]">{metric.label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="font-mono text-2xl font-semibold tracking-tight text-[var(--ink)]">{metric.value}</p>
            <span className={metric.delta.startsWith("-") ? "text-xs font-medium text-[var(--risk)]" : "text-xs font-medium text-[var(--brand)]"}>
              {metric.delta}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{metric.helper}</p>
        </article>
      ))}
    </section>
  );
}

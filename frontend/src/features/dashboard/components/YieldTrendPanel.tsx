import type { YieldPoint } from "../placeholder/dashboard-data";

export function YieldTrendPanel({ points }: Readonly<{ points: YieldPoint[] }>) {
  const width = 930;
  const height = 246;
  const values = points.flatMap((point) => [point.yieldPct, point.baselinePct]);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const toX = (index: number) => 40 + (index * (width - 80)) / (points.length - 1);
  const toY = (value: number) => 20 + ((max - value) / (max - min)) * (height - 54);
  const yieldPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.yieldPct)}`).join(" ");
  const baselinePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.baselinePct)}`).join(" ");

  return (
    <div className="grid grid-cols-[15rem_minmax(0,1fr)]">
      <div className="border-r border-[var(--line)] px-5 py-5">
        <p className="text-xs font-medium text-[var(--muted)]">Comparable batches</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight" id="trend-title">Yield trend</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">The latest two Mina batches are below the relevant median.</p>
        <div className="mt-6 space-y-3 text-xs">
          <Legend color="bg-[var(--brand)]" label="Confirmed yield" />
          <Legend color="border-t-2 border-dashed border-[var(--chart-baseline)]" label="Comparable median" />
          <p className="border-t border-[var(--line)] pt-3 font-mono text-[var(--muted)]">12 comparable batches</p>
        </div>
      </div>
      <div className="px-5 py-5">
        <svg aria-labelledby="trend-title" className="h-[246px] w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
          {[0, 1, 2, 3].map((line) => <line key={line} stroke="var(--line)" strokeDasharray="3 5" x1="34" x2={width - 34} y1={28 + line * 52} y2={28 + line * 52} />)}
          <path className="trend-baseline" d={baselinePath} fill="none" stroke="var(--chart-baseline)" strokeDasharray="7 7" strokeWidth="2" />
          <path className="trend-line" d={yieldPath} fill="none" stroke="var(--brand)" strokeLinecap="square" strokeLinejoin="round" strokeWidth="3" />
          {points.map((point, index) => (
            <g key={point.label}>
              <circle cx={toX(index)} cy={toY(point.yieldPct)} fill="var(--surface)" r="4.5" stroke="var(--brand)" strokeWidth="2" />
              {index === points.length - 1 ? <circle cx={toX(index)} cy={toY(point.yieldPct)} fill="var(--risk)" r="2.5" /> : null}
              <text fill="var(--muted)" fontSize="11" textAnchor="middle" x={toX(index)} y={height - 7}>{point.label.replace("Aug ", "")}</text>
            </g>
          ))}
        </svg>
        <table className="sr-only">
          <caption>Yield trend by processing day</caption>
          <thead><tr><th>Date</th><th>Confirmed yield</th><th>Comparable median</th></tr></thead>
          <tbody>{points.map((point) => <tr key={point.label}><td>{point.label}</td><td>{point.yieldPct}%</td><td>{point.baselinePct}%</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ color, label }: Readonly<{ color: string; label: string }>) {
  return <div className="flex items-center gap-2 text-[var(--muted)]"><span aria-hidden="true" className={`h-0 w-5 ${color}`} /><span>{label}</span></div>;
}

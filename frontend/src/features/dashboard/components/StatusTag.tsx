type StatusTagProps = {
  label: string;
  tone: "risk" | "neutral";
};

export function StatusTag({ label, tone }: Readonly<StatusTagProps>) {
  const toneClass =
    tone === "risk"
      ? "border-[var(--risk-line)] bg-[var(--risk-soft)] text-[var(--risk)]"
      : "border-[var(--line-strong)] bg-[var(--surface-subtle)] text-[var(--muted)]";

  return <span className={`inline-flex shrink-0 border px-2 py-1 text-[10px] font-semibold ${toneClass}`}>{label}</span>;
}

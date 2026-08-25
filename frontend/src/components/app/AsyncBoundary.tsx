import type { ReactNode } from "react";
import { CircleAlert, Inbox, LoaderCircle } from "lucide-react";

type AsyncBoundaryProps = {
  className?: string;
  isLoading: boolean;
  error?: Error;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  children: ReactNode;
};

/**
 * Renders loading, error, and empty states around data that arrives from a feature
 * api module. Present now so real network latency needs no new UI work later.
 */
export function AsyncBoundary({
  className,
  children,
  emptyMessage = "There is nothing recorded here yet.",
  emptyTitle = "Nothing to show",
  error,
  isEmpty = false,
  isLoading
}: Readonly<AsyncBoundaryProps>) {
  if (isLoading) {
    return (
      <div className={`flex min-h-[18rem] flex-col items-center justify-center gap-3 border-y border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] ${className ?? ""}`}>
        <LoaderCircle aria-hidden="true" className="animate-spin" size={22} strokeWidth={1.75} />
        <p className="text-sm">Loading production data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex min-h-[18rem] flex-col items-center justify-center gap-3 border-y border-[var(--risk-line)] bg-[var(--risk-soft)] px-6 text-center ${className ?? ""}`}>
        <CircleAlert aria-hidden="true" className="text-[var(--risk)]" size={22} strokeWidth={1.75} />
        <p className="text-sm font-semibold text-[var(--risk)]">Could not load this workspace</p>
        <p className="max-w-md text-xs leading-5 text-[var(--muted)]">{error.message}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`flex min-h-[18rem] flex-col items-center justify-center gap-3 border-y border-[var(--line)] bg-[var(--surface)] px-6 text-center ${className ?? ""}`}>
        <Inbox aria-hidden="true" className="text-[var(--brand)]" size={24} strokeWidth={1.5} />
        <p className="text-sm font-semibold text-[var(--ink)]">{emptyTitle}</p>
        <p className="max-w-md text-xs leading-5 text-[var(--muted)]">{emptyMessage}</p>
      </div>
    );
  }

  return className ? <div className={className}>{children}</div> : <>{children}</>;
}

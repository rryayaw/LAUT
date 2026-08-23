"use client";

import { CircleAlert, X } from "lucide-react";

type WriteErrorBannerProps = {
  error: Error | undefined;
  onDismiss: () => void;
};

/** Surfaces a failed write without discarding what the operator was doing. */
export function WriteErrorBanner({ error, onDismiss }: Readonly<WriteErrorBannerProps>) {
  if (!error) return null;

  return (
    <div
      className="mt-4 flex items-start gap-3 border border-[var(--risk-line)] bg-[var(--risk-soft)] px-4 py-3"
      role="alert"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--risk)]" size={16} strokeWidth={1.75} />
      <p className="min-w-0 flex-1 text-xs leading-5 text-[var(--ink)]">{error.message}</p>
      <button
        aria-label="Dismiss"
        className="shrink-0 text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        onClick={onDismiss}
        type="button"
      >
        <X aria-hidden="true" size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}

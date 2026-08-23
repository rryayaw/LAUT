"use client";

import { useCallback, useState } from "react";

export type WriteAction<TArgs extends unknown[]> = {
  run: (...args: TArgs) => void;
  error: Error | undefined;
  isPending: boolean;
  dismissError: () => void;
};

/**
 * Wraps a write to a feature api module.
 *
 * Dialogs submit and close optimistically, so a failed request would otherwise
 * disappear silently along with the operator's input. This keeps the failure in
 * hand for the view to render.
 */
export function useWriteAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<unknown>,
  onSuccess?: () => void
): WriteAction<TArgs> {
  const [error, setError] = useState<Error>();
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(
    (...args: TArgs) => {
      setIsPending(true);
      setError(undefined);

      action(...args)
        .then(() => onSuccess?.())
        .catch((cause: unknown) => setError(cause instanceof Error ? cause : new Error(String(cause))))
        .finally(() => setIsPending(false));
    },
    // The action closes over view state and is redefined per render; the caller
    // controls when a rerun is meaningful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action, onSuccess]
  );

  return { run, error, isPending, dismissError: useCallback(() => setError(undefined), []) };
}

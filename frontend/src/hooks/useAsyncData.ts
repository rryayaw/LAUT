"use client";

import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> = {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  reload: () => void;
};

/**
 * Reads data from a feature `api/` module.
 *
 * Every view goes through this rather than importing placeholder data directly,
 * so swapping an api module to a real network call needs no component changes.
 */
export function useAsyncData<T>(load: () => Promise<T>, deps: readonly unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  // The loader is defined inline at call sites; `deps` is the real dependency list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runLoad = useCallback(load, deps);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    runLoad()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(undefined);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [runLoad, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, error, isLoading, reload };
}

// Short-lived request cache.
//
// Several views compose the same reads — the dashboard needs batches and their
// analyses, the investigations page needs both again, and the shell needs sites on
// every page. The backend has no aggregate projections yet, so each of those reads
// fans out into a handful of requests. Caching them briefly keeps navigation
// responsive without letting the UI show stale figures for long.
//
// Delete this once the backend exposes list projections that answer a view in one
// request.

const TTL_MS = 15_000;

type Entry = { value: Promise<unknown>; storedAt: number };

const entries = new Map<string, Entry>();

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = entries.get(key);
  if (existing && Date.now() - existing.storedAt < TTL_MS) return existing.value as Promise<T>;

  const value = load().catch((error: unknown) => {
    // A failed read must not be replayed to every later caller.
    entries.delete(key);
    throw error;
  });

  entries.set(key, { value, storedAt: Date.now() });
  return value;
}

/** Called after every write so the next read reflects it. */
export function invalidateCache(prefix?: string): void {
  if (prefix === undefined) {
    entries.clear();
    return;
  }
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

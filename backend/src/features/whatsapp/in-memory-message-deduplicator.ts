export class InMemoryMessageDeduplicator {
  private readonly claimedAt = new Map<string, number>();

  constructor(
    private readonly ttlMs = 15 * 60 * 1000,
    private readonly maximumEntries = 1_000
  ) {}

  claim(key: string) {
    this.removeExpired();
    if (this.claimedAt.has(key)) return false;

    if (this.claimedAt.size >= this.maximumEntries) {
      const oldestKey = this.claimedAt.keys().next().value;
      if (oldestKey) this.claimedAt.delete(oldestKey);
    }
    this.claimedAt.set(key, Date.now());
    return true;
  }

  release(key: string) {
    this.claimedAt.delete(key);
  }

  private removeExpired() {
    const oldestAllowed = Date.now() - this.ttlMs;
    for (const [key, claimedAt] of this.claimedAt) {
      if (claimedAt >= oldestAllowed) break;
      this.claimedAt.delete(key);
    }
  }
}
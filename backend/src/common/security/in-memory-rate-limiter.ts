type Counter = {
  count: number;
  resetAt: number;
};

const PRUNE_THRESHOLD = 2000;

export class InMemoryRateLimiter {
  private readonly counters = new Map<string, Counter>();

  consume(
    key: string,
    max: number,
    windowMs: number,
    now = Date.now(),
  ): boolean {
    this.pruneIfNeeded(now);
    const current = this.counters.get(key);
    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= max) {
      return false;
    }
    current.count += 1;
    return true;
  }

  isLimited(key: string, max: number, now = Date.now()): boolean {
    const current = this.counters.get(key);
    return Boolean(current && current.resetAt > now && current.count >= max);
  }

  reset(key: string): void {
    this.counters.delete(key);
  }

  clear(): void {
    this.counters.clear();
  }

  private pruneIfNeeded(now: number): void {
    if (this.counters.size < PRUNE_THRESHOLD) {
      return;
    }
    for (const [key, value] of this.counters) {
      if (value.resetAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}

import { InMemoryRateLimiter } from './in-memory-rate-limiter';

describe('InMemoryRateLimiter', () => {
  it('allows up to max requests in the window and blocks the next', () => {
    const limiter = new InMemoryRateLimiter();
    const now = 1_000_000;

    expect(limiter.consume('ip', 2, 60_000, now)).toBe(true);
    expect(limiter.consume('ip', 2, 60_000, now + 10)).toBe(true);
    expect(limiter.consume('ip', 2, 60_000, now + 20)).toBe(false);
    expect(limiter.isLimited('ip', 2, now + 20)).toBe(true);
  });

  it('resets after the window expires', () => {
    const limiter = new InMemoryRateLimiter();
    const now = 1_000_000;

    expect(limiter.consume('ip', 1, 1000, now)).toBe(true);
    expect(limiter.consume('ip', 1, 1000, now + 500)).toBe(false);
    expect(limiter.consume('ip', 1, 1000, now + 1000)).toBe(true);
  });

  it('tracks keys independently and can reset one key', () => {
    const limiter = new InMemoryRateLimiter();
    const now = 1_000_000;

    expect(limiter.consume('a', 1, 60_000, now)).toBe(true);
    expect(limiter.consume('b', 1, 60_000, now)).toBe(true);
    limiter.reset('a');
    expect(limiter.consume('a', 1, 60_000, now)).toBe(true);
    expect(limiter.consume('b', 1, 60_000, now)).toBe(false);
  });
});

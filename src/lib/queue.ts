/** Tiny dependency-free rate limiter + retry helpers for external APIs. */

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Serializes calls with a minimum interval between starts. Apollo (and Google
 * pagination) are called through this so a collection run can't burst past
 * provider rate limits.
 */
export class RateLimiter {
  private chain: Promise<void> = Promise.resolve();
  private lastStart = 0;

  constructor(private minIntervalMs: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.chain.then(async () => {
      const wait = this.lastStart + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastStart = Date.now();
      return fn();
    });
    // Keep the chain alive even when a call rejects.
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Retry with exponential backoff. Only retries RetryableError (429/5xx/network);
 * anything else (bad request, auth failure) fails fast.
 */
export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 5;
  const base = opts.baseDelayMs ?? 1000;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!(err instanceof RetryableError) || i === attempts - 1) throw err;
      const delay = err.retryAfterMs ?? base * 2 ** i + Math.random() * 500;
      console.warn(
        `[retry] ${opts.label ?? "call"} failed (attempt ${i + 1}/${attempts}), waiting ${Math.round(delay)}ms: ${err.message}`,
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Run tasks with bounded concurrency (used for website probes). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

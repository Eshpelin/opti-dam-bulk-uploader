/**
 * Token-bucket rate limiter for CMP API calls.
 *
 * Capacity: 6 tokens, refill rate: 6 tokens/second.
 * Only applies to api.cmp.optimizely.com calls, NOT S3 presigned URLs.
 *
 * Also handles 429 responses with exponential backoff + jitter.
 */

const BUCKET_CAPACITY = 6;
const REFILL_RATE = 6; // tokens per second
const REFILL_INTERVAL_MS = 1000 / REFILL_RATE;

let tokens = BUCKET_CAPACITY;
let lastRefillTime = Date.now();
const waitQueue: Array<() => void> = [];

let backoffUntil = 0; // timestamp - if > Date.now(), we are in backoff

function refill() {
  const now = Date.now();
  const elapsed = now - lastRefillTime;
  const newTokens = Math.floor(elapsed / REFILL_INTERVAL_MS);

  if (newTokens > 0) {
    tokens = Math.min(BUCKET_CAPACITY, tokens + newTokens);
    lastRefillTime = now;
  }
}

function drainQueue() {
  while (waitQueue.length > 0 && tokens > 0) {
    tokens--;
    const resolve = waitQueue.shift()!;
    resolve();
  }
}

export async function acquire(): Promise<void> {
  // If we are in a backoff period from a 429, wait it out
  const now = Date.now();
  if (backoffUntil > now) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, backoffUntil - now)
    );
  }

  refill();

  if (tokens > 0) {
    tokens--;
    return;
  }

  // No tokens available. Queue and wait.
  return new Promise<void>((resolve) => {
    waitQueue.push(resolve);

    // Set a timer to try refilling and draining
    setTimeout(() => {
      refill();
      drainQueue();
    }, REFILL_INTERVAL_MS);
  });
}

/**
 * Call this when a 429 response is received.
 * Parses Retry-After header and sets a global backoff.
 */
export function handleRateLimit(retryAfterHeader?: string | null): number {
  let backoffMs: number;

  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      backoffMs = seconds * 1000;
    } else {
      backoffMs = 2000;
    }
  } else {
    backoffMs = 2000;
  }

  // Add jitter (0-500ms)
  backoffMs += Math.random() * 500;
  backoffUntil = Date.now() + backoffMs;

  // Drain any pending waiters after the backoff
  setTimeout(() => {
    refill();
    drainQueue();
  }, backoffMs);

  return backoffMs;
}

/**
 * Execute a function with rate limiting and automatic 429 retry.
 * Retries up to maxRetries times with exponential backoff.
 */
export async function withRateLimit<T>(
  fn: () => Promise<Response>,
  maxRetries = 5
): Promise<Response> {
  let attempt = 0;

  while (true) {
    await acquire();

    const response = await fn();

    if (response.status !== 429) {
      return response;
    }

    attempt++;
    if (attempt >= maxRetries) {
      return response; // return the 429 response, let caller handle
    }

    const retryAfter = response.headers.get("Retry-After");
    const baseDelay = handleRateLimit(retryAfter);

    // Exponential backoff for subsequent retries
    const expDelay = Math.min(
      baseDelay * Math.pow(2, attempt - 1),
      60000
    );
    const jitter = Math.random() * 500;
    await new Promise((resolve) =>
      setTimeout(resolve, expDelay + jitter)
    );
  }
}

/**
 * Reset the rate limiter state. Useful for testing.
 */
export function reset() {
  tokens = BUCKET_CAPACITY;
  lastRefillTime = Date.now();
  backoffUntil = 0;
  waitQueue.length = 0;
}

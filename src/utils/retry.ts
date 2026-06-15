/**
 * IMPL: retry with exponential backoff, used for backend MCP connections.
 */
export interface RetryOptions {
  retries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  onAttempt?: (attempt: number, error: unknown, nextDelayMs: number) => void;
  signal?: AbortSignal;
}

export class RetryAbortedError extends Error {
  constructor() {
    super('retry aborted');
    this.name = 'RetryAbortedError';
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new RetryAbortedError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new RetryAbortedError());
      },
      { once: true },
    );
  });
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 10_000;
  const factor = options.factor ?? 2;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (options.signal?.aborted) throw new RetryAbortedError();
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const delay = Math.min(initialDelayMs * factor ** attempt, maxDelayMs);
      options.onAttempt?.(attempt + 1, err, delay);
      await sleep(delay, options.signal);
    }
  }
  throw lastError;
}

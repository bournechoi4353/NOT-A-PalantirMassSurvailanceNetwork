export class TimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Timeout after ${ms}ms: ${url}`);
    this.name = 'TimeoutError';
  }
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number; next?: { revalidate?: number } } = {},
): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = opts;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const { attempts = 2, baseDelayMs = 300, label = 'op' } = opts;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = baseDelayMs * Math.pow(2, i) + Math.random() * 100;
      console.warn(`[${label}] attempt ${i + 1} failed, retrying in ${Math.round(delay)}ms:`, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

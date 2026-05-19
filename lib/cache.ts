import type { Camera, CameraSource } from './types';

type Entry = { data: Camera[]; at: number };

const TTL_MS: Record<CameraSource, number> = {
  tfl: 5 * 60 * 1000,
  caltrans: 5 * 60 * 1000,
  windy: 30 * 60 * 1000,
  earthcam: 60 * 60 * 1000,
  drivebc: 60 * 60 * 1000,
  on511: 5 * 60 * 1000,
  ab511: 5 * 60 * 1000,
  mdot: 5 * 60 * 1000,
};

const cache = new Map<CameraSource, Entry>();
const inflight = new Map<CameraSource, Promise<Camera[]>>();

export async function cached(
  source: CameraSource,
  fetcher: () => Promise<Camera[]>,
): Promise<Camera[]> {
  const now = Date.now();
  const entry = cache.get(source);
  if (entry && now - entry.at < TTL_MS[source]) return entry.data;

  const existing = inflight.get(source);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetcher();
      cache.set(source, { data, at: Date.now() });
      return data;
    } catch (err) {
      if (entry) {
        console.warn(`[${source}] fetch failed, serving stale (${Math.round((now - entry.at) / 1000)}s old):`, err);
        return entry.data;
      }
      throw err;
    } finally {
      inflight.delete(source);
    }
  })();

  inflight.set(source, promise);
  return promise;
}

export function cacheStatus(): Record<string, { ageSeconds: number; count: number }> {
  const out: Record<string, { ageSeconds: number; count: number }> = {};
  const now = Date.now();
  for (const [source, entry] of cache.entries()) {
    out[source] = {
      ageSeconds: Math.round((now - entry.at) / 1000),
      count: entry.data.length,
    };
  }
  return out;
}

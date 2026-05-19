// Public-domain military installations from Wikidata.
//
// Wikidata SPARQL is generally reliable but the query takes ~10s globally and
// returns ~6MB JSON. We cache the result in module scope for 24h and fall back
// to stale data on transient failures.
import { NextResponse } from 'next/server';
import { fetchMilitaryBases } from '@/lib/sources/militaryBases';
import type { MilitaryBase } from '@/lib/types';

export const revalidate = 86_400;

type Entry = { data: MilitaryBase[]; at: number };
let cache: Entry | null = null;
let inflight: Promise<MilitaryBase[]> | null = null;
const TTL_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ bases: cache.data, cached: true });
  }
  if (!inflight) {
    inflight = fetchMilitaryBases()
      .then((data) => {
        cache = { data, at: Date.now() };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    const data = await inflight;
    return NextResponse.json({ bases: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cache) {
      // serve stale so the map still renders during an upstream blip
      return NextResponse.json({ bases: cache.data, stale: true, error: msg });
    }
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

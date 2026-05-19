// Pull every instance of "military base" (Wikidata Q245016) plus all
// subclasses (P31/P279*) that has a coordinate (P625). This is the
// canonical free, global, public dataset — ~12k installations as of 2026.
// The data is public information (governments themselves publish base
// locations); we're just rendering points.
import type { MilitaryBase } from '@/lib/types';
import { fetchWithTimeout } from '@/lib/http';

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const UA = 'NOT-A-PalantirMassSurvailanceNetwork/0.1 (jchoi1267@gmail.com)';

const SPARQL = `
SELECT ?base ?baseLabel ?coord ?countryLabel WHERE {
  ?base wdt:P31/wdt:P279* wd:Q245016 .
  ?base wdt:P625 ?coord .
  OPTIONAL { ?base wdt:P17 ?country . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`.trim();

type SparqlBinding = {
  base: { value: string };
  baseLabel?: { value: string };
  coord: { value: string };
  countryLabel?: { value: string };
};

const POINT_RE = /^Point\(([-\d.eE+]+) ([-\d.eE+]+)\)$/;

export async function fetchMilitaryBases(): Promise<MilitaryBase[]> {
  const params = new URLSearchParams({ query: SPARQL, format: 'json' });
  // cache: 'no-store' — the response is ~6MB which exceeds Next.js' 2MB fetch
  // cache limit. With caching attempted, the body can come back corrupted (the
  // dev cache writer truncates mid-string and we get JSON parse errors).
  // We do our own in-memory cache in the API route instead.
  const res = await fetchWithTimeout(`${WIKIDATA_SPARQL_URL}?${params}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/sparql-results+json',
    },
    timeoutMs: 90_000,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Wikidata SPARQL HTTP ${res.status}`);
  const json = (await res.json()) as { results: { bindings: SparqlBinding[] } };

  const out: MilitaryBase[] = [];
  const seen = new Set<string>();
  for (const row of json.results.bindings) {
    const m = row.coord?.value?.match(POINT_RE);
    if (!m) continue;
    const lon = Number(m[1]);
    const lat = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const id = row.base.value;
    if (seen.has(id)) continue; // dedupe — multi-coord bases
    seen.add(id);
    out.push({
      id,
      name: row.baseLabel?.value ?? 'Unknown',
      lat,
      lon,
      country: row.countryLabel?.value,
    });
  }
  return out;
}

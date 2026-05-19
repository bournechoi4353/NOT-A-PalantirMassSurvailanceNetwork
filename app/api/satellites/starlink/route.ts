// CelesTrak Starlink TLE feed.
//
// Primary: gp.php?GROUP=starlink — the documented general-perturbations feed.
// Fallback: supplemental/sup-gp.php?FILE=starlink — SpaceX-supplied data with
// the same 3-line TLE format and (usually) more entries. Used when the GP
// endpoint returns 403, which happens when the requesting IP has already
// downloaded the same GROUP recently (CelesTrak's per-IP cooldown — 2h).
//
// Cache: Next.js revalidate=86400 (24h). Once a day is plenty fresh for
// orbital propagation; SGP4 stays accurate for ~a week from TLE epoch.
import { NextResponse } from 'next/server';

export const revalidate = 86400;

const UA = 'PublicCamDashboard/0.1 (+https://github.com)';
const PRIMARY =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle';
const FALLBACK =
  'https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=tle';

type TleRecord = { name: string; tle1: string; tle2: string };

function parseTle(text: string): TleRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  const out: TleRecord[] = [];
  for (let i = 0; i + 2 < lines.length; ) {
    const name = lines[i];
    const tle1 = lines[i + 1];
    const tle2 = lines[i + 2];
    if (tle1.startsWith('1 ') && tle2.startsWith('2 ')) {
      out.push({ name: name.trim(), tle1, tle2 });
      i += 3;
    } else {
      i += 1;
    }
  }
  return out;
}

async function fetchTle(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/plain' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

export async function GET() {
  let text: string;
  let sourceUrl = PRIMARY;
  try {
    text = await fetchTle(PRIMARY);
  } catch (primaryErr) {
    try {
      text = await fetchTle(FALLBACK);
      sourceUrl = FALLBACK;
    } catch (fallbackErr) {
      return NextResponse.json(
        {
          error: 'Both CelesTrak endpoints failed',
          primary: String(primaryErr),
          fallback: String(fallbackErr),
        },
        { status: 502 },
      );
    }
  }

  const records = parseTle(text);
  if (records.length === 0) {
    return NextResponse.json(
      { error: 'No TLE records parsed', sourceUrl, bytes: text.length },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      count: records.length,
      source: sourceUrl,
      fetchedAt: new Date().toISOString(),
      records,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=86400, stale-while-revalidate=172800',
      },
    },
  );
}

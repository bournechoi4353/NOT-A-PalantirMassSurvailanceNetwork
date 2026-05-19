# Public Cam Dashboard

A world map of **publicly listed** webcams and traffic cameras. Aggregates feeds from:

| Source                   | Type           | Auth                | Notes                                  |
| ------------------------ | -------------- | ------------------- | -------------------------------------- |
| TfL JamCams              | London traffic | None                | ~900 cams, ~1 min refresh              |
| Caltrans                 | CA highways    | None                | ~3000 cams across 9 districts          |
| Windy Webcams API        | Global         | API key (free tier) | Optional — skipped if `WINDY_API_KEY` empty |
| EarthCam (curated)       | Famous places  | None                | Hardcoded list, opens externally       |

All sources are operator-published feeds with public APIs or curated public listings. This project does **not** access any camera that isn't intentionally broadcast publicly.

## Run it

```bash
npm install
cp .env.example .env.local   # optional, add WINDY_API_KEY if you have one
npm run dev
```

Open <http://localhost:3000>. The page fetches from all sources at request time and caches for 5 minutes.

## API

`GET /api/cameras` → `{ count, errors, cameras: Camera[] }`

Each `Camera` is normalized to:

```ts
type Camera = {
  id: string;
  source: 'tfl' | 'caltrans' | 'windy' | 'earthcam';
  title: string;
  lat: number;
  lon: number;
  snapshotUrl?: string;  // periodically-refreshing JPEG
  videoUrl?: string;     // HLS / MP4
  embedUrl?: string;     // iframe-safe URL
  externalUrl?: string;  // open-in-new-tab link
  refreshSeconds?: number;
  city?: string;
  country?: string;
};
```

## Adding a source

1. Create `lib/sources/<name>.ts` exporting `fetch<Name>Cameras(): Promise<Camera[]>`.
2. Register it in [lib/aggregator.ts](lib/aggregator.ts).
3. Add a label + color to `SOURCE_META` in [lib/types.ts](lib/types.ts).

## Notes

- **Snapshot images** are polled client-side using a cache-busting query param at the source's stated refresh interval.
- **EarthCam** doesn't expose a public API, so the pins for it open the EarthCam site in a new tab rather than embedding (their pages set `X-Frame-Options: DENY`).
- **Windy** rate-limits the free tier; the API route caches responses for 30 minutes.
- Tile layer is CartoDB dark, served over OpenStreetMap data. No API key required.

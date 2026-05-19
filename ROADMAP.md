# Roadmap

Phased plan from the current MVP through a production-grade public-cam dashboard with a CV/analytics layer. Estimates are in **days of focused solo work** — sum them for a calendar plan based on your real availability.

Total: **~6–7 weeks** of focused work to reach Phase 7 (production deploy + analytics).

---

## ✅ Phase 1 — Foundation *(done)*

The MVP that's already in this repo.

**Shipped:**
- Next.js 14 + TypeScript scaffold, dark CartoDB map, Leaflet.
- Four sources normalized to a single `Camera` type: TfL JamCams (882), Caltrans (3 225), Windy (key-gated), EarthCam (curated, 7).
- `/api/cameras` aggregator with per-source error capture and 5-min revalidate.
- `LivePlayer` with three modes: HLS (`● LIVE`), looping MP4 (`● NEAR-LIVE`), polling snapshot.
- Sidebar with per-source toggles + counts.

**Result:** ~4 100 live/near-live cams across one click.

---

## Phase 2 — Reliability & polish *(2–3 days)*

Make the MVP not embarrassing when someone actually opens it.

| Task | Files |
| --- | --- |
| Marker clustering (4 k pins is fine, will choke at 20 k) — add `react-leaflet-cluster` | [components/CameraMap.tsx](components/CameraMap.tsx) |
| Server-side in-memory cache (LRU, keyed by source) so cold loads don't fan out to 9 Caltrans districts every time | new `lib/cache.ts` |
| Per-source timeout + retry with exponential backoff | [lib/aggregator.ts](lib/aggregator.ts) |
| Mobile responsive sidebar (collapse to a hamburger under 640 px) | [components/Sidebar.tsx](components/Sidebar.tsx) |
| Empty/error states in popup (today: text-only fallback) | [components/LivePlayer.tsx](components/LivePlayer.tsx) |
| Loading skeleton on initial fetch | [app/Dashboard.tsx](app/Dashboard.tsx) |
| Lint + format setup (`eslint`, `prettier`) | `package.json`, `.eslintrc` |

**Exit criteria:** 10 k+ markers smooth, no source can wedge the page, looks usable on a phone.

---

## Phase 3 — More sources *(5–8 days)*

Get the camera count from ~4 k to ~15 k+ and expand geography to 5 continents. Split into three sub-phases by integration friction, so we ship value early instead of waiting on signup latency for the whole batch.

### Phase 3a — Zero-friction batch *(2 days)*

No API keys, no signed agreements, no scraping. Same code shape as existing sources in [lib/sources/](lib/sources/).

| Source | Status | Cameras (verified) | Notes |
| --- | --- | --- | --- |
| **DriveBC** | ✅ working | 1 034 | `lib/sources/drivebc.ts`. Bundled CSV downloaded from `catalogue.data.gov.bc.ca` (resource `webcams.csv`). Note: the CSV's `links_imageDisplay` column now serves a placeholder PNG for every id; we build snapshot URLs from `https://www.drivebc.ca/images/{id}.jpg` instead (verified live). |
| **Ontario 511** | ✅ working | 1 651 | `lib/sources/on511.ts`. One pin per view (931 cameras × multiple views). Snapshot URL: `https://511on.ca/map/Cctv/{ViewId}?image` returns image/jpeg. |
| **Alberta 511** | ✅ working | 599 | `lib/sources/ab511.ts`. One pin per *enabled* view; same snapshot pattern as Ontario. |
| **MDOT CHART** (Maryland) | ✅ working | 550 | `lib/sources/mdot.ts`. No static-image endpoint exists — uses `publicVideoURL` as iframe embed (the canonical HLS player at chart.maryland.gov). Direct m3u8 fetch from our container timed out, so we don't promise inline playback from our server; the embed page works in user browsers. |
| **Germany Autobahn** | ⚠ TODO | 0 | `verkehr.autobahn.de/o/autobahn/{road}/services/webcam` returns `{"webcam":[]}` for all 109 roads listed by the `/o/autobahn` index (probed May 2026). Other services (`/warning`, `/closure`) return data, so the API is alive but the webcam feature appears deprecated or temporarily emptied. No adapter written. |

**Actual result:** 7 948 cams in the dashboard (was 4 114 with just tfl + caltrans + earthcam, before windy is configured). +3 834 cameras, zero signups, zero `.env` changes.

*(Hong Kong TD and Transport for NSW originally listed here turned out to require signup — see 3b.)*

### Phase 3b — Signup-required batch *(2 days)*

All free signups. Most US 511 systems share the iPeak / Compusult template — same REST shape, ~10 req/min throttle. Write one shared client, plug in credentials per source. (Ontario + Alberta were originally here but turned out keyless — moved to 3a.)

| Source | Endpoint shape | Approx count | Notes |
| --- | --- | --- | --- |
| **511NY** | `511ny.org/api/getcameras?key=...` | ~1 500 | Includes Thruway |
| **511GA** | `511ga.org/api/v2/get/cameras?key=...` | ~1 200 | Includes HLS `VideoUrl` (genuine live, like Caltrans) |
| **511LA** | `511la.org/api/v2/get/cameras?key=...` | ~600 | Verify if keyless first (same family as Ontario/Alberta) |
| **WSDOT** (Washington) | `wsdot.wa.gov/Traffic/api/HighwayCameras/...?AccessCode=...` | ~600 | Slightly different shape; JPEG snapshots only. Email signup, ~24h turnaround — request first |
| **Hong Kong TD** *(moved from 3a)* | `https://tdcctv.data.one.gov.hk/...` + metadata CSV | JPEG, 320×240, 2-min refresh | ~200 | Snapshot-only. Register on data.gov.hk |
| **Transport for NSW** *(moved from 3a)* | `opendata.transport.nsw.gov.au/.../livetrafficcamera.json` | GeoJSON | ~500 | CC-BY Attribution. Register an app at opendata.transport.nsw.gov.au |

Shared client lives in `lib/sources/_ipeak.ts` (only for the 511 family); HK TD and NSW need their own one-off adapters. Document keys in `.env.example`. **Result:** +4 600 cams once all signups complete.

### Phase 3c — Curated public webcams *(1–2 days)*

Non-DOT sources for the "fun" pins.

| Source | Approach | Approx count |
| --- | --- | --- |
| Skyline Webcams | Scrape their public sitemap; respect `robots.txt`; cache aggressively | ~2 000 |
| NOAA coastal / weather cams | Public listing | ~150 |
| YouTube Live (curated livestream IDs) | Hand-picked JSON file like EarthCam | ~50 |

### Sources we will **not** integrate (and why)

- **VDOT 511 / PennDOT / MassDOT / Traffic Scotland / Traffic Wales** — require signed agreements with Iteris or similar. Out of scope for a free public project.
- **Singapore LTA** — most expressway feeds shut down **30 June 2026** (ERP 2.0 migration). Not worth integrating six weeks before deprecation; revisit only if the surviving Woodlands/Tuas/Sentosa subset matters.
- **TxDOT / FDOT / 511NJ** — no documented public API; scrape-only. Fragile; revisit only with a specific use case.
- **TrafficLand** — commercial aggregator (~25 k cams, 50+ DOTs). Right answer for a production product that needs national US coverage; wrong answer for an OSS project.
- **RITIS** — gated to credentialed agency/research users.
- **Insecam.org** — explicitly skipped: indexes unsecured private cameras whose owners didn't opt in. Privacy + legal grey zone.
- **DDOT live video** — locations only via Open Data DC; live access is internal/FOIA. Plot pins from the metadata, but no live feed.

### Standards & shared infrastructure

Worth knowing as we add sources — these shape our integration code, not new features:

- **Open511** (XML+JSON) — used by DriveBC, Ontario 511, the iPeak family. The camera resource is "draft" but stable enough in practice.
- **DATEX II** — European standard (Scotland, Wales, NDW, ASFINAG, Highways England). Skip for now; revisit if/when we add registered-access EU feeds.
- **NTCIP 1205** — US ITS standard underlying many DOT camera control systems. We won't touch this directly; it just explains why most JSON shapes are slightly weird.

### Optional DMV-focused sub-track *(0.5–1 day, only if you want to lean DMV)*

Triggered by the research doc's depth on DC/VA/MD. Build a `/dmv` page with a tighter zoom and these sources only:

- MDOT CHART (already in Phase 3a) — Maryland highways
- DDOT camera locations from Open Data DC — locations-only pins; popup links out to the DC traffic map
- Arlington County intersection cams (~200) — scrape `arlingtonva.us/.../Live-Traffic-Cameras`
- Montgomery County ATMS (~234) — `atms.montgomerycountymd.gov/jpgcap/TL/` snapshot endpoint

Skip unless DMV is the actual target market — adds ~500 cams of dubious global appeal.

### Aggregate exit criteria

- ✅ 12+ live sources across 5 continents (NA, EU, Asia, Oceania, plus existing London)
- ✅ Camera count ≥ 12 000
- ✅ Sidebar groups sources by region (US, Europe, Asia-Pacific, Curated)
- ✅ Sources requiring keys document them in `.env.example`; project still runs with zero env vars (just shows fewer cams)
- ✅ Per-source license / attribution credit shown in a footer (legal hygiene)

---

## Phase 4 — Power-user UX *(4–7 days)*

The features that make people share the link.

| Task | Notes |
| --- | --- |
| **Search bar** — fuzzy match on title/city/country, fly map to result | Add `fuse.js`, ~half day |
| **Favorites** — star icon per camera, persisted in `localStorage`, "Favorites" filter | half day |
| **Multi-view grid** — pick 4 / 9 / 16 cams, play simultaneously in a wall view at `/wall` | 1–2 days; reuse `LivePlayer` |
| **Auto-rotate** — cycle through favorites every N seconds, kiosk mode | half day |
| **Picture-in-picture** — browser-native PiP on the popup video | 0.5 day |
| **Permalink to a camera** — `/?cam=tfl:JamCams_X` opens popup on load | 0.5 day |
| **Keyboard shortcuts** — `/` search, `f` favorite, `g` go-to | 0.5 day |
| **Bigger camera detail page** — `/cam/[id]` with HLS player, location map inset, history (if Phase 5 done) | 1 day |

**Exit criteria:** can pin 9 cams to a wall, share a permalink to a specific cam, full keyboard navigation.

---

## Phase 5 — Server-side capture & history *(5–7 days)*

Stop being read-only. Capture snapshots over time so the site has a memory.

| Task | Notes |
| --- | --- |
| **Cron worker** — every 5 min, grab a snapshot from N "featured" cams | Vercel Cron or a separate Node worker |
| **Storage** — pick one: S3 / R2 (cheap), or SQLite + file system for self-host | Cloudflare R2 is cheapest and CORS-friendly |
| **Schema** — `snapshots(id, camera_id, captured_at, url, sha256, width, height)`; use Postgres (Neon free tier) or SQLite | |
| **Timeline UI on camera detail page** — scrub through the last 24h of snapshots | 1 day |
| **Retention policy** — keep last 7d full-res, 30d thumbnails, delete older | 0.5 day |
| **Storage budget guard** — soft-cap on disk usage, oldest-first eviction | 0.5 day |

**Cost ballpark:** at 200 featured cams × 12/hr × 24h × 100 KB ≈ **6 GB/day**, ~$0.15/mo on R2.

**Exit criteria:** open a camera's detail page → see today's timeline of snapshots, scrub like a video.

---

## Phase 6 — Computer vision layer *(7–14 days)*

The "actually interesting" phase. Run inference on captured frames; surface signals.

| Task | Notes |
| --- | --- |
| **Inference worker** — pull recent snapshots, run YOLO (e.g. `ultralytics` Python service) | Detects person, car, truck, bicycle, traffic light |
| **Detection storage** — `detections(snapshot_id, class, bbox, confidence)` | Postgres or DuckDB |
| **Per-cam dashboards** — vehicle count over 24h, day-of-week heatmaps | 2 days, recharts/visx |
| **Anomaly detection** — flag cams whose vehicle count diverges 3σ from rolling baseline → "Unusual activity at [cam]" feed | 2 days |
| **Weather classifier** — image classification (fog/rain/snow/clear) on coastal & highway cams | 1 day (use a pre-trained model) |
| **Public "trends" page** — `/trends` showing aggregate stats: busiest cam right now, weather map, etc. | 2 days |

**Hardware:** one $5/mo VPS with CPU YOLO is enough for ~50 frames/min. Scale by sampling, not by buying GPUs.

**Exit criteria:** live "traffic right now" page, anomaly feed updates in real time, weather overlay on the map.

---

## Phase 7 — Production deploy *(2–3 days)*

Make it real.

| Task | Notes |
| --- | --- |
| Deploy frontend + API to Vercel (or Cloudflare Pages + Workers) | |
| Set up `WINDY_API_KEY`, source API keys as env secrets | |
| Custom domain + HTTPS | |
| Edge cache headers tuned per route (`/api/cameras` is already `s-maxage=300`) | |
| **Rate limiting** on `/api/cameras` — Upstash Redis, e.g. 60 req/min/IP | |
| Sentry or similar for error tracking | |
| Basic analytics (Plausible, no cookies needed) | |
| Status page or healthcheck endpoint `/api/health` reporting per-source status | |

**Exit criteria:** public URL, observable, doesn't fall over under HN front-page traffic (a few hundred concurrent).

---

## Phase 8 — Optional extensions *(open-ended)*

Pick what's interesting.

- **Public API** — `/api/v1/cameras` with API keys, pagination, geo-bounding-box filter. Lets other people build on it.
- **Embed widget** — `<iframe src=".../embed?cam=tfl:X">` for blogs.
- **Mobile app** — React Native or PWA wrapper around the existing site. The map already works on phones after Phase 2.
- **Discord/Slack bot** — `/cam times square` returns latest snapshot.
- **Time-lapse generator** — given a cam and date range, stitch snapshots into MP4 (`ffmpeg`).
- **Federated mode** — `/sources/add` accepts user-submitted RTSP/HLS URLs they own.

---

## Cross-cutting concerns (always)

These don't get their own phase — bake them into every phase as you go.

- **Privacy & ToS** — re-read each source's terms before integrating; record what's allowed in `lib/sources/<name>.ts` as a top-of-file comment. If a source says no scraping / no caching, respect it.
- **No private cams.** This project is publicly-listed feeds only. Reject any source where the operator didn't intentionally publish.
- **Per-source license / attribution** — surface in a credits footer. Track in code as a `license` field on each camera or per-source constant (CC-BY for NSW, Open Government License for DriveBC, TfL Open Data, etc.).
- **No footage retention** — most agencies (VDOT, Caltrans, MDOT CHART, NSW, Singapore LTA) explicitly do **not** retain footage; some auto-delete (DDOT: 90 days, National Highways: 7 days). If we ever add server-side capture (Phase 5), our retention policy must be ours alone; we can't lean on agency archives.
- **EU/UK GDPR** — DATEX II partners and most European feeds restrict storage of imagery. If we add registered-access European sources later, legal review precedes integration; don't store frames from those.
- **Type safety** — every new source returns `Promise<Camera[]>`; no shortcuts.

## Reference: full source survey

A comprehensive directory of worldwide DOT/CCTV sources (open, free-key, agreement-only, and skipped) — including DMV deep-dive, Open511/DATEX II standards, federal context (FHWA, RITIS), and per-region access tiers — is maintained as a separate research artifact. The Phase 3 picks above are the curated subset that's actually buildable without signed agreements or paid keys.

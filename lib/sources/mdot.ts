// MDOT CHART (Maryland) — keyless JSON feed.
// Endpoint: https://chart.maryland.gov/DataFeeds/GetCamerasJson
// Shape (verified May 2026, 553 cameras):
//   [{ id, name, description, lat, lon, milePost, routeNumber, routePrefix,
//      routeSuffix, cctvIp, opStatus, commMode, publicVideoURL,
//      cameraCategories, lastCachedDataUpdateTime }]
// Snapshot URL: no static-image endpoint exists. `publicVideoURL` points to
//   chart.maryland.gov/Video/GetVideo/{id}, which loads an HLS player
//   (video-js + video.min.js) that pulls m3u8 from an internal CCTV host
//   (e.g. strmr5.sha.maryland.gov). Direct m3u8 fetch from outside the
//   chart.maryland.gov page timed out for us (server-side egress check),
//   so we don't promise HLS playback here. We surface each cam as a pin
//   with the publicVideoURL as an iframe embed — that is the canonical
//   public viewer and works in browsers.
// License: Maryland DOT CHART; explicit "no footage retention" policy.
import type { Camera } from '../types';
import { fetchWithTimeout, withRetry } from '../http';

type MdotCamera = {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lon: number;
  routeNumber?: number;
  routePrefix?: string;
  routeSuffix?: string;
  opStatus?: string;
  commMode?: string;
  publicVideoURL?: string;
};

export async function fetchMdotCameras(): Promise<Camera[]> {
  return withRetry(
    async () => {
      const res = await fetchWithTimeout(
        'https://chart.maryland.gov/DataFeeds/GetCamerasJson',
        { timeoutMs: 12000, next: { revalidate: 600 } },
      );
      if (!res.ok) throw new Error(`MDOT CHART: ${res.status}`);
      const data = (await res.json()) as MdotCamera[];

      return data
        .map((c): Camera | null => {
          if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return null;
          if (c.commMode !== 'ONLINE') return null;
          if (!c.publicVideoURL) return null;
          const route = [c.routePrefix, c.routeNumber, c.routeSuffix]
            .filter(Boolean)
            .join('-');
          const title = c.name || c.description || `CHART ${c.id}`;
          return {
            id: `mdot:${c.id}`,
            source: 'mdot',
            title: route ? `${route}: ${title}` : title,
            lat: c.lat,
            lon: c.lon,
            embedUrl: c.publicVideoURL,
            externalUrl: c.publicVideoURL,
            refreshSeconds: 60,
            country: 'USA',
          };
        })
        .filter((c): c is Camera => c !== null);
    },
    { attempts: 2, label: 'mdot' },
  ).catch((err) => {
    console.error('MDOT CHART gave up:', err);
    return [];
  });
}

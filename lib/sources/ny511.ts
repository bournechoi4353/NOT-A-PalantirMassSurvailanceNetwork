// 511NY — NYSDOT statewide CCTV.
// Endpoint:  https://511ny.org/api/GetCameras?key=…&format=json
// Auth:      Free key from https://511ny.org/developers (set NY511_API_KEY).
// Shape:     Flat list of {Latitude, Longitude, ID, Name, DirectionOfTravel,
//                          RoadwayName, Url, VideoUrl, Disabled, Blocked}.
// Snapshot:  `${Url}?image` returns image/jpeg (verified May 2026 against
//            ids 4 and 4435 — Cloudfront-fronted).
// Live:      ~60% of enabled cameras have an HLS VideoUrl
//            (s5*.nysdot.skyvdn.com:443/.../playlist.m3u8). The rest are
//            snapshot-only.
// License:   © NYSDOT; data published under 511NY's developer terms.
import type { Camera } from '../types';
import { fetchWithTimeout, withRetry } from '../http';

type Ny511Camera = {
  Latitude: number;
  Longitude: number;
  ID: string;
  Name: string;
  DirectionOfTravel?: string;
  RoadwayName?: string;
  Url: string;
  VideoUrl?: string | null;
  Disabled?: boolean;
  Blocked?: boolean;
};

export async function fetchNy511Cameras(): Promise<Camera[]> {
  const key = process.env.NY511_API_KEY?.trim();
  if (!key) return [];

  return withRetry(
    async () => {
      const url = `https://511ny.org/api/GetCameras?key=${encodeURIComponent(key)}&format=json`;
      const res = await fetchWithTimeout(url, {
        timeoutMs: 15000,
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
      });
      if (!res.ok) throw new Error(`511NY: ${res.status}`);
      const data = (await res.json()) as Ny511Camera[];

      const out: Camera[] = [];
      for (const cam of data) {
        if (cam.Disabled || cam.Blocked) continue;
        if (!Number.isFinite(cam.Latitude) || !Number.isFinite(cam.Longitude)) continue;

        out.push({
          id: `ny511:${cam.ID}`,
          source: 'ny511',
          title: cam.Name,
          lat: cam.Latitude,
          lon: cam.Longitude,
          snapshotUrl: `${cam.Url}?image`,
          videoUrl: cam.VideoUrl ?? undefined,
          externalUrl: cam.Url,
          refreshSeconds: 60,
          country: 'USA',
        });
      }
      return out;
    },
    { attempts: 2, label: 'ny511' },
  ).catch((err) => {
    console.error('511NY gave up:', err);
    return [];
  });
}

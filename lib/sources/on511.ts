// Ontario 511 — keyless iPeak/Open511-style feed.
// Endpoint:  https://511on.ca/api/v2/get/cameras
// Shape:     [{Id, Source, SourceId, Roadway, Direction, Latitude, Longitude,
//             Location, Views: [{Id, Url, Status, Description}]}]
// Snapshot:  Views[].Url is the map embed page (e.g. .../map/Cctv/123).
//            The same path with `?image` query returns the live JPEG (verified
//            May 2026 against 4 random ids — all returned image/jpeg from
//            AXIS Q605x cameras).
// License:   © Queen's Printer for Ontario; Open Government License - Ontario.
import type { Camera } from '../types';
import { fetchWithTimeout, withRetry } from '../http';

type On511View = {
  Id: number;
  Url: string;
  Status: string;
  Description?: string;
};

type On511Camera = {
  Id: number;
  Roadway?: string;
  Direction?: string;
  Latitude: number;
  Longitude: number;
  Location?: string;
  Views?: On511View[];
};

export async function fetchOntario511Cameras(): Promise<Camera[]> {
  return withRetry(
    async () => {
      const res = await fetchWithTimeout('https://511on.ca/api/v2/get/cameras', {
        timeoutMs: 12000,
        next: { revalidate: 600 },
      });
      if (!res.ok) throw new Error(`Ontario 511: ${res.status}`);
      const data = (await res.json()) as On511Camera[];

      const out: Camera[] = [];
      for (const cam of data) {
        if (!Number.isFinite(cam.Latitude) || !Number.isFinite(cam.Longitude)) continue;
        const views = cam.Views ?? [];
        for (const v of views) {
          if (v.Status !== 'Enabled') continue;
          const labelParts = [cam.Location || cam.Roadway || `Cam ${cam.Id}`];
          if (v.Description && v.Description !== cam.Location) labelParts.push(v.Description);
          out.push({
            id: `on511:${v.Id}`,
            source: 'on511',
            title: labelParts.join(' — '),
            lat: cam.Latitude,
            lon: cam.Longitude,
            snapshotUrl: `https://511on.ca/map/Cctv/${v.Id}?image`,
            externalUrl: v.Url,
            refreshSeconds: 60,
            country: 'Canada',
          });
        }
      }
      return out;
    },
    { attempts: 2, label: 'on511' },
  ).catch((err) => {
    console.error('Ontario 511 gave up:', err);
    return [];
  });
}

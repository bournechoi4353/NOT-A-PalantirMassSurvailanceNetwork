// Alberta 511 — keyless iPeak feed, same shape as Ontario 511.
// Endpoint:  https://511.alberta.ca/api/v2/get/cameras
// Snapshot:  https://511.alberta.ca/map/Cctv/{ViewId}?image returns
//            image/jpeg (verified May 2026 against 4 random view ids).
// Note:      Unlike Ontario, Alberta has Disabled views (~3% of the total) —
//            filter those out.
// License:   © Government of Alberta; Open Government License - Alberta.
import type { Camera } from '../types';
import { fetchWithTimeout, withRetry } from '../http';

type Ab511View = {
  Id: number;
  Url: string;
  Status: string;
  Description?: string;
};

type Ab511Camera = {
  Id: number;
  Roadway?: string;
  Direction?: string;
  Latitude: number;
  Longitude: number;
  Location?: string;
  Views?: Ab511View[];
};

export async function fetchAlberta511Cameras(): Promise<Camera[]> {
  return withRetry(
    async () => {
      const res = await fetchWithTimeout('https://511.alberta.ca/api/v2/get/cameras', {
        timeoutMs: 12000,
        next: { revalidate: 600 },
      });
      if (!res.ok) throw new Error(`Alberta 511: ${res.status}`);
      const data = (await res.json()) as Ab511Camera[];

      const out: Camera[] = [];
      for (const cam of data) {
        if (!Number.isFinite(cam.Latitude) || !Number.isFinite(cam.Longitude)) continue;
        const views = cam.Views ?? [];
        for (const v of views) {
          if (v.Status !== 'Enabled') continue;
          const labelParts = [cam.Location || cam.Roadway || `Cam ${cam.Id}`];
          if (v.Description && v.Description !== cam.Location) labelParts.push(v.Description);
          out.push({
            id: `ab511:${v.Id}`,
            source: 'ab511',
            title: labelParts.join(' — '),
            lat: cam.Latitude,
            lon: cam.Longitude,
            snapshotUrl: `https://511.alberta.ca/map/Cctv/${v.Id}?image`,
            externalUrl: v.Url,
            refreshSeconds: 60,
            country: 'Canada',
          });
        }
      }
      return out;
    },
    { attempts: 2, label: 'ab511' },
  ).catch((err) => {
    console.error('Alberta 511 gave up:', err);
    return [];
  });
}

import type { Camera } from '../types';
import { fetchWithTimeout, withRetry } from '../http';

const DISTRICTS = ['3', '4', '5', '6', '7', '8', '10', '11', '12'];

type CaltransEntry = {
  cctv: {
    index: string;
    location: {
      district: string;
      locationName: string;
      nearbyPlace?: string;
      latitude: string;
      longitude: string;
    };
    imageData: {
      static?: { currentImageURL?: string };
      streamingVideoURL?: string;
    };
  };
};

async function fetchDistrict(d: string): Promise<Camera[]> {
  const dd = d.padStart(2, '0');
  const url = `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${dd}.json`;

  return withRetry(
    async () => {
      const res = await fetchWithTimeout(url, {
        timeoutMs: 8000,
        next: { revalidate: 600 },
      });
      if (!res.ok) throw new Error(`Caltrans D${d}: ${res.status}`);
      const data = (await res.json()) as { data: CaltransEntry[] };
      return data.data
        .map((item): Camera | null => {
          const c = item.cctv;
          const lat = parseFloat(c.location.latitude);
          const lon = parseFloat(c.location.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0) return null;

          const snapshot = c.imageData.static?.currentImageURL?.trim();
          const video = c.imageData.streamingVideoURL?.trim();
          if (!snapshot && !video) return null;

          return {
            id: `caltrans:${d}:${c.index}`,
            source: 'caltrans',
            title: c.location.locationName || c.location.nearbyPlace || `D${d} #${c.index}`,
            lat,
            lon,
            snapshotUrl: snapshot || undefined,
            videoUrl: video || undefined,
            refreshSeconds: 30,
            city: `Caltrans D${d}`,
            country: 'USA',
          };
        })
        .filter((c): c is Camera => c !== null);
    },
    { attempts: 2, label: `caltrans-d${d}` },
  ).catch((err) => {
    console.error(`Caltrans D${d} gave up:`, err);
    return [];
  });
}

export async function fetchCaltransCameras(): Promise<Camera[]> {
  const lists = await Promise.all(DISTRICTS.map(fetchDistrict));
  return lists.flat();
}

import type { Camera } from '../types';
import { fetchWithTimeout, withRetry } from '../http';

type TflPlace = {
  id: string;
  commonName: string;
  lat: number;
  lon: number;
  additionalProperties: { key: string; value: string }[];
};

export async function fetchTflCameras(): Promise<Camera[]> {
  return withRetry(
    async () => {
      const res = await fetchWithTimeout('https://api.tfl.gov.uk/Place/Type/JamCam', {
        timeoutMs: 8000,
        next: { revalidate: 600 },
      });
      if (!res.ok) throw new Error(`TfL request failed: ${res.status}`);
      const data: TflPlace[] = await res.json();

      return data
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
        .map((p) => {
          const props = Object.fromEntries(
            p.additionalProperties.map((a) => [a.key, a.value]),
          );
          return {
            id: `tfl:${p.id}`,
            source: 'tfl' as const,
            title: p.commonName,
            lat: p.lat,
            lon: p.lon,
            snapshotUrl: props.imageUrl,
            videoUrl: props.videoUrl,
            refreshSeconds: 60,
            city: 'London',
            country: 'UK',
          };
        });
    },
    { attempts: 2, label: 'tfl' },
  );
}

import type { Camera, CameraSource } from './types';
import { cached } from './cache';
import { fetchTflCameras } from './sources/tfl';
import { fetchCaltransCameras } from './sources/caltrans';
import { fetchWindyCameras } from './sources/windy';
import { fetchEarthcamFeeds } from './sources/earthcam';

type Result = { cameras: Camera[]; errors: Record<string, string> };

const SOURCES: Record<CameraSource, () => Promise<Camera[]>> = {
  tfl: fetchTflCameras,
  caltrans: fetchCaltransCameras,
  windy: fetchWindyCameras,
  earthcam: fetchEarthcamFeeds,
};

export async function fetchAllCameras(): Promise<Result> {
  const entries = await Promise.all(
    (Object.entries(SOURCES) as [CameraSource, () => Promise<Camera[]>][]).map(
      async ([name, fn]) => {
        try {
          const data = await cached(name, fn);
          return [name, data, null] as const;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return [name, [] as Camera[], msg] as const;
        }
      },
    ),
  );

  const cameras: Camera[] = [];
  const errors: Record<string, string> = {};
  for (const [name, list, err] of entries) {
    cameras.push(...list);
    if (err) errors[name] = err;
  }
  return { cameras, errors };
}

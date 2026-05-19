import type { Camera, CameraSource } from './types';
import { cached } from './cache';
import { fetchTflCameras } from './sources/tfl';
import { fetchCaltransCameras } from './sources/caltrans';
import { fetchWindyCameras } from './sources/windy';
import { fetchEarthcamFeeds } from './sources/earthcam';
import { fetchDriveBcCameras } from './sources/drivebc';
import { fetchOntario511Cameras } from './sources/on511';
import { fetchAlberta511Cameras } from './sources/ab511';
import { fetchMdotCameras } from './sources/mdot';

type Result = { cameras: Camera[]; errors: Record<string, string> };

const SOURCES: Record<CameraSource, () => Promise<Camera[]>> = {
  tfl: fetchTflCameras,
  caltrans: fetchCaltransCameras,
  windy: fetchWindyCameras,
  earthcam: fetchEarthcamFeeds,
  drivebc: fetchDriveBcCameras,
  on511: fetchOntario511Cameras,
  ab511: fetchAlberta511Cameras,
  mdot: fetchMdotCameras,
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

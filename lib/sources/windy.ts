import type { Camera } from '../types';
import { fetchWithTimeout, withRetry } from '../http';

type WindyWebcam = {
  webcamId: number;
  title: string;
  viewCount?: number;
  status?: string;
  location: {
    city?: string;
    country?: string;
    latitude: number;
    longitude: number;
  };
  images?: { current?: { preview?: string; thumbnail?: string } };
  player?: { day?: string; live?: string };
};

type WindyResponse = { webcams: WindyWebcam[] };

export async function fetchWindyCameras(): Promise<Camera[]> {
  const key = process.env.WINDY_API_KEY;
  if (!key) return [];

  return withRetry(
    async () => {
      const params = new URLSearchParams({
        limit: '100',
        include: 'images,location,player',
      });
      const res = await fetchWithTimeout(
        `https://api.windy.com/webcams/api/v3/webcams?${params}`,
        {
          headers: { 'x-windy-api-key': key },
          timeoutMs: 10000,
          next: { revalidate: 1800 },
        },
      );
      if (!res.ok) throw new Error(`Windy: ${res.status}`);

      const data = (await res.json()) as WindyResponse;
      return data.webcams
        .filter(
          (w) =>
            Number.isFinite(w.location?.latitude) &&
            Number.isFinite(w.location?.longitude),
        )
        .map((w) => ({
          id: `windy:${w.webcamId}`,
          source: 'windy' as const,
          title: w.title,
          lat: w.location.latitude,
          lon: w.location.longitude,
          snapshotUrl: w.images?.current?.preview,
          embedUrl: w.player?.live || w.player?.day,
          externalUrl: `https://www.windy.com/webcams/${w.webcamId}`,
          refreshSeconds: 300,
          city: w.location.city,
          country: w.location.country,
        }));
    },
    { attempts: 2, label: 'windy' },
  );
}

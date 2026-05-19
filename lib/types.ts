export type CameraSource = 'tfl' | 'caltrans' | 'windy' | 'earthcam';

export type Camera = {
  id: string;
  source: CameraSource;
  title: string;
  lat: number;
  lon: number;
  snapshotUrl?: string;
  videoUrl?: string;
  embedUrl?: string;
  externalUrl?: string;
  refreshSeconds?: number;
  city?: string;
  country?: string;
};

export const SOURCE_META: Record<CameraSource, { label: string; color: string }> = {
  tfl: { label: 'TfL JamCams (London)', color: '#dc2626' },
  caltrans: { label: 'Caltrans (California)', color: '#f59e0b' },
  windy: { label: 'Windy Webcams', color: '#2563eb' },
  earthcam: { label: 'EarthCam (curated)', color: '#16a34a' },
};

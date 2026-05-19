export type CameraSource =
  | 'tfl'
  | 'caltrans'
  | 'windy'
  | 'earthcam'
  | 'drivebc'
  | 'on511'
  | 'ab511'
  | 'mdot';

export type CameraRegion = 'us' | 'europe' | 'apac' | 'curated';

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

export type SourceMeta = {
  label: string;
  color: string;
  region: CameraRegion;
  attribution: string;
  attributionUrl?: string;
};

export const SOURCE_META: Record<CameraSource, SourceMeta> = {
  tfl: {
    label: 'TfL JamCams (London)',
    color: '#dc2626',
    region: 'europe',
    attribution: 'Powered by TfL Open Data',
    attributionUrl: 'https://tfl.gov.uk/info-for/open-data-users/',
  },
  caltrans: {
    label: 'Caltrans (California)',
    color: '#f59e0b',
    region: 'us',
    attribution: 'Caltrans Performance Measurement System',
    attributionUrl: 'https://cwwp2.dot.ca.gov/',
  },
  mdot: {
    label: 'MDOT CHART (Maryland)',
    color: '#a855f7',
    region: 'us',
    attribution: 'Maryland DOT CHART — footage not retained',
    attributionUrl: 'https://chart.maryland.gov/',
  },
  drivebc: {
    label: 'DriveBC (British Columbia)',
    color: '#0ea5e9',
    region: 'us',
    attribution: 'Contains information licensed under the Open Government Licence – BC',
    attributionUrl: 'https://www2.gov.bc.ca/gov/content/data/open-data',
  },
  on511: {
    label: 'Ontario 511',
    color: '#ef4444',
    region: 'us',
    attribution: '© Queen’s Printer for Ontario — Open Government Licence – Ontario',
    attributionUrl: 'https://511on.ca/',
  },
  ab511: {
    label: 'Alberta 511',
    color: '#facc15',
    region: 'us',
    attribution: '© Government of Alberta — Open Government Licence – Alberta',
    attributionUrl: 'https://511.alberta.ca/',
  },
  windy: {
    label: 'Windy Webcams',
    color: '#2563eb',
    region: 'curated',
    attribution: 'Windy.com Webcams API',
    attributionUrl: 'https://www.windy.com/webcams',
  },
  earthcam: {
    label: 'EarthCam (curated)',
    color: '#16a34a',
    region: 'curated',
    attribution: 'EarthCam livestreams (curated picks)',
    attributionUrl: 'https://www.earthcam.com/',
  },
};

export const REGION_META: Record<CameraRegion, { label: string; order: number }> = {
  us: { label: 'North America', order: 0 },
  europe: { label: 'Europe', order: 1 },
  apac: { label: 'Asia-Pacific', order: 2 },
  curated: { label: 'Curated', order: 3 },
};

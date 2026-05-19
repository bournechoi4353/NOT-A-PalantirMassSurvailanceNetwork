import type { Camera } from '../types';

const FEEDS: Array<Omit<Camera, 'source'>> = [
  {
    id: 'earthcam:times-square',
    title: 'Times Square, NYC',
    lat: 40.758,
    lon: -73.9855,
    externalUrl: 'https://www.earthcam.com/cams/newyork/timessquare/',
    city: 'New York',
    country: 'USA',
  },
  {
    id: 'earthcam:bourbon-street',
    title: 'Bourbon Street, New Orleans',
    lat: 29.9584,
    lon: -90.0648,
    externalUrl: 'https://www.earthcam.com/usa/louisiana/neworleans/bourbonstreet/',
    city: 'New Orleans',
    country: 'USA',
  },
  {
    id: 'earthcam:abbey-road',
    title: 'Abbey Road Crossing, London',
    lat: 51.532,
    lon: -0.1779,
    externalUrl: 'https://www.earthcam.com/world/england/london/abbeyroad/',
    city: 'London',
    country: 'UK',
  },
  {
    id: 'earthcam:dublin-temple-bar',
    title: 'Temple Bar, Dublin',
    lat: 53.3454,
    lon: -6.2649,
    externalUrl: 'https://www.earthcam.com/world/ireland/dublin/templebar/',
    city: 'Dublin',
    country: 'Ireland',
  },
  {
    id: 'earthcam:dubai',
    title: 'Dubai Skyline',
    lat: 25.1972,
    lon: 55.2744,
    externalUrl: 'https://www.earthcam.com/world/uae/dubai/',
    city: 'Dubai',
    country: 'UAE',
  },
  {
    id: 'earthcam:venice-rialto',
    title: 'Rialto Bridge, Venice',
    lat: 45.4380,
    lon: 12.3359,
    externalUrl: 'https://www.earthcam.com/world/italy/venice/rialtobridge/',
    city: 'Venice',
    country: 'Italy',
  },
  {
    id: 'earthcam:miami-beach',
    title: 'Miami Beach, FL',
    lat: 25.7907,
    lon: -80.13,
    externalUrl: 'https://www.earthcam.com/usa/florida/miamibeach/',
    city: 'Miami',
    country: 'USA',
  },
];

export async function fetchEarthcamFeeds(): Promise<Camera[]> {
  return FEEDS.map((f) => ({ ...f, source: 'earthcam' as const }));
}

// Shared satellite types & math used by the client-side overlay.
//
// Propagation uses satellite.js's pure-JS SGP4 (propagate + eciToGeodetic).
// The library accepts a JS Date directly; do NOT pass a unix timestamp.

import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
  type SatRec,
} from 'satellite.js';

export type TleRecord = { name: string; tle1: string; tle2: string };

export type Satellite = {
  id: string;
  name: string;
  satrec: SatRec;
};

export type SatPosition = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  altKm: number;
};

const EARTH_RADIUS_KM = 6371;

export function buildSatellites(records: TleRecord[]): Satellite[] {
  const out: Satellite[] = [];
  for (const r of records) {
    try {
      const satrec = twoline2satrec(r.tle1, r.tle2);
      out.push({ id: String(satrec.satnum ?? r.name), name: r.name, satrec });
    } catch {
      // skip malformed
    }
  }
  return out;
}

// Returns null if SGP4 fails (orbit decayed, etc).
export function propagateAt(sat: Satellite, date: Date): SatPosition | null {
  const pv = propagate(sat.satrec, date);
  // satellite.js@5 returns { position: false, velocity: false } on error.
  if (!pv || typeof pv.position === 'boolean') return null;
  const gmst = gstime(date);
  const geo = eciToGeodetic(pv.position, gmst);
  const lat = degreesLat(geo.latitude);
  const lng = ((degreesLong(geo.longitude) + 540) % 360) - 180;
  const altKm = geo.height;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(altKm)) {
    return null;
  }
  return { id: sat.id, name: sat.name, lat, lng, altKm };
}

// Sample positions across [centerTime - halfWindowMs, centerTime + halfWindowMs]
// every stepMs and return as [lng, lat] arrays grouped into sub-paths that
// don't cross the antimeridian. (deck.gl PathLayer expects [x, y] = [lng, lat].)
export function groundTrackSegments(
  sat: Satellite,
  centerTime: Date,
  halfWindowMs = 45 * 60 * 1000,
  stepMs = 30 * 1000,
): Array<Array<[number, number]>> {
  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  let prevLng: number | null = null;
  const start = centerTime.getTime() - halfWindowMs;
  const end = centerTime.getTime() + halfWindowMs;
  for (let t = start; t <= end; t += stepMs) {
    const pos = propagateAt(sat, new Date(t));
    if (!pos) {
      if (current.length > 1) segments.push(current);
      current = [];
      prevLng = null;
      continue;
    }
    if (prevLng !== null && Math.abs(pos.lng - prevLng) > 180) {
      // antimeridian crossing — close this segment and start a new one
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push([pos.lng, pos.lat]);
    prevLng = pos.lng;
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

// Surface-distance from sub-satellite point to the visible-horizon limb of a
// satellite at altitude `altKm`. This is the radius of the ground footprint
// (the area on Earth that can see the satellite above the horizon).
//   r_ground = R_earth * arccos(R_earth / (R_earth + altitude))
export function footprintRadiusMeters(altKm: number): number {
  const r = EARTH_RADIUS_KM;
  const ratio = r / (r + Math.max(altKm, 1));
  const clamped = Math.max(-1, Math.min(1, ratio));
  return r * Math.acos(clamped) * 1000;
}

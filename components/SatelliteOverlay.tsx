'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildSatellites,
  orbitTrackSegments,
  propagateAt,
  type SatPosition,
  type Satellite,
  type TleRecord,
} from '@/lib/satellites';

const UPDATE_HZ = 1; // 1 Hz — see SATELLITES.md.
const FETCH_URL = '/api/satellites/starlink';

export type SatTrackSegment = Array<[number, number, number]>;

export type StarlinkState = {
  positions: SatPosition[];
  /** Predicted ground track for one satellite, in [lng,lat,altMeters] tuples
   *  broken at antimeridian crossings. Returns null if id is unknown. */
  getTrack: (id: string) => SatTrackSegment[] | null;
};

/**
 * Returns live Starlink positions (refreshed at 1 Hz) when `show` is true,
 * otherwise an empty array. Also exposes a `getTrack(id)` that returns the
 * predicted orbital ground track for a single satellite — used by the globe
 * to show where a selected satellite is heading.
 */
export function useStarlinkPositions(show: boolean): StarlinkState {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [positions, setPositions] = useState<SatPosition[]>([]);
  const satellitesRef = useRef<Satellite[]>([]);
  satellitesRef.current = satellites;

  useEffect(() => {
    if (!show || satellites.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(FETCH_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { records: TleRecord[] };
        if (cancelled) return;
        setSatellites(buildSatellites(json.records));
      } catch {
        // Silent: globe still works without satellites.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show, satellites.length]);

  useEffect(() => {
    if (!show || satellites.length === 0) {
      setPositions([]);
      return;
    }
    const tick = () => {
      const now = new Date();
      const next: SatPosition[] = [];
      for (const sat of satellitesRef.current) {
        const p = propagateAt(sat, now);
        if (p) next.push(p);
      }
      setPositions(next);
    };
    tick();
    const id = window.setInterval(tick, 1000 / UPDATE_HZ);
    return () => window.clearInterval(id);
  }, [show, satellites]);

  const getTrack = useCallback((id: string): SatTrackSegment[] | null => {
    const sat = satellitesRef.current.find((s) => s.id === id);
    if (!sat) return null;
    return orbitTrackSegments(sat, new Date());
  }, []);

  return { positions, getTrack };
}

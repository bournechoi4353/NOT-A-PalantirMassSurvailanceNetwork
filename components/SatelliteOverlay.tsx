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

<<<<<<< HEAD
// At globe scale (visible from km, not meters), 2 s between updates looks
// identical to 1 s but halves the React/render cost. Bump back up to 1 if
// we ever zoom in tight enough to see per-second motion.
const UPDATE_HZ = 0.5;
=======
const UPDATE_MS = 2000; // 0.5 Hz — perf tradeoff for drag responsiveness.
>>>>>>> d6826ed9ae9032560dc8256788d4dac4768fc10b
const FETCH_URL = '/api/satellites/starlink';
const SAT_SAMPLE_RATE = 5; // keep every 5th sat (~2k of ~10k) — perf.

export type SatTrackSegment = Array<[number, number, number]>;

export type StarlinkState = {
  positions: SatPosition[];
  /** Predicted ground track for one satellite, in [lng,lat,altMeters] tuples
   *  broken at antimeridian crossings. Returns null if id is unknown. */
  getTrack: (id: string) => SatTrackSegment[] | null;
};

/**
 * Returns live Starlink positions (refreshed at 0.5 Hz) when `show` is true,
 * otherwise an empty array. Also exposes a `getTrack(id)` that returns the
 * predicted orbital ground track for a single satellite — used by the globe
 * to show where a selected satellite is heading.
 */
export function useStarlinkPositions(
  show: boolean,
  pausedRef?: React.MutableRefObject<boolean>,
): StarlinkState {
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
        // Downsample BEFORE building — buildSatellites is the expensive step.
        const sampled = json.records.filter((_, i) => i % SAT_SAMPLE_RATE === 0);
        setSatellites(buildSatellites(sampled));
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
      // Skip propagation entirely while the user is dragging the globe —
      // the drag camera move is at 60 Hz and competing for the main thread.
      if (pausedRef?.current) return;
      const now = new Date();
      const next: SatPosition[] = [];
      for (const sat of satellitesRef.current) {
        const p = propagateAt(sat, now);
        if (p) next.push(p);
      }
      setPositions(next);
    };
    tick();
    const id = window.setInterval(tick, UPDATE_MS);
    return () => window.clearInterval(id);
  }, [show, satellites, pausedRef]);

  const getTrack = useCallback((id: string): SatTrackSegment[] | null => {
    const sat = satellitesRef.current.find((s) => s.id === id);
    if (!sat) return null;
    return orbitTrackSegments(sat, new Date());
  }, []);

  return { positions, getTrack };
}

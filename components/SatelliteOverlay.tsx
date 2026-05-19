'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
// Import the ESM build directly. The package's "browser" field points at the
// UMD bundle, which webpack flags with "named export not found" even though it
// works at runtime via interop. The ESM file has proper `export { LeafletLayer }`.
// Type declaration for this explicit subpath lives in src/types/deck-gl-leaflet-esm.d.ts.
import { LeafletLayer } from 'deck.gl-leaflet/dist/deck.gl-leaflet.esm.js';
import type { Layer, PickingInfo } from '@deck.gl/core';
import {
  buildSatellites,
  propagateAt,
  groundTrackSegments,
  footprintRadiusMeters,
  type SatPosition,
  type Satellite,
  type TleRecord,
} from '@/lib/satellites';

type Props = { show: boolean };

const UPDATE_HZ = 1; // 1 Hz default — see SATELLITES.md for the perf rationale.
const FETCH_URL = '/api/satellites/starlink';

export default function SatelliteOverlay({ show }: Props) {
  const map = useMap();
  const layerRef = useRef<LeafletLayer | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mirror state in refs so the per-frame closure can read latest values
  // without becoming a useEffect dep (which would tear down the interval).
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const satellitesRef = useRef<Satellite[]>([]);
  satellitesRef.current = satellites;

  // 1. Fetch & parse TLE on first show.
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
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show, satellites.length]);

  // 2. Mount LeafletLayer once per `show` cycle. Click handling lives at the
  //    Deck level so hits and misses both flow through one path.
  useEffect(() => {
    if (!show) return;
    const layer = new LeafletLayer({
      pickingRadius: 6,
      onClick: (info: PickingInfo) => {
        const o = info.object as SatPosition | null;
        setSelectedId(o ? o.id : null);
      },
      getTooltip: ({ object }: PickingInfo) => {
        const o = object as SatPosition | null;
        if (!o) return null;
        return {
          html: `<div style="padding:4px 8px;background:rgba(15,23,42,0.92);color:#e2e8f0;border-radius:4px;font-family:system-ui,sans-serif;font-size:11px;white-space:nowrap;">${escapeHtml(o.name)} · ${o.altKm.toFixed(0)} km</div>`,
          style: { background: 'transparent', border: '0' },
        };
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
      if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }
    };
  }, [map, show]);

  // 3. Per-frame propagation + layer update + footprint circle.
  useEffect(() => {
    if (!show || satellites.length === 0 || !layerRef.current) return;

    const tick = () => {
      const sats = satellitesRef.current;
      const sel = selectedRef.current;
      const now = new Date();
      const positions: SatPosition[] = [];
      for (const sat of sats) {
        const p = propagateAt(sat, now);
        if (p) positions.push(p);
      }
      const selPos = sel ? positions.find((p) => p.id === sel) : undefined;

      const layers: Layer[] = [
        new ScatterplotLayer<SatPosition>({
          id: 'starlink-dots',
          data: positions,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: 2,
          radiusUnits: 'pixels',
          getFillColor: (d) =>
            d.id === sel ? [56, 248, 248, 255] : [148, 226, 255, 200],
          pickable: true,
          stroked: false,
          updateTriggers: { getFillColor: sel },
        }),
      ];

      if (selPos) {
        const selSat = sats.find((s) => s.id === selPos.id);
        if (selSat) {
          const segs = groundTrackSegments(selSat, now);
          layers.push(
            new PathLayer<Array<[number, number]>>({
              id: 'starlink-track',
              data: segs,
              getPath: (seg) => seg,
              getColor: [56, 248, 248, 200],
              widthUnits: 'pixels',
              getWidth: 2,
              pickable: false,
            }),
          );
        }
        const radius = footprintRadiusMeters(selPos.altKm);
        if (circleRef.current) {
          circleRef.current.setLatLng([selPos.lat, selPos.lng]).setRadius(radius);
        } else {
          circleRef.current = L.circle([selPos.lat, selPos.lng], {
            radius,
            color: '#38f8f8',
            weight: 1,
            opacity: 0.7,
            fillColor: '#38f8f8',
            fillOpacity: 0.06,
            interactive: false,
          }).addTo(map);
        }
      } else if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }

      layerRef.current?.setProps({ layers });
    };

    tick();
    const id = window.setInterval(tick, 1000 / UPDATE_HZ);
    return () => window.clearInterval(id);
  }, [satellites, show, map]);

  if (!show) return null;
  if (loadError) {
    return <Status text={`Starlink TLE failed: ${loadError}`} tone="error" />;
  }
  if (satellites.length === 0) {
    return <Status text="Loading Starlink TLEs…" tone="muted" />;
  }
  return (
    <Status
      text={`${satellites.length.toLocaleString()} Starlink · ${UPDATE_HZ} Hz`}
      tone="muted"
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function Status({ text, tone }: { text: string; tone: 'muted' | 'error' }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
        background: tone === 'error' ? 'rgba(127, 29, 29, 0.92)' : 'rgba(15, 23, 42, 0.92)',
        color: tone === 'error' ? '#fee2e2' : '#94a3b8',
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}

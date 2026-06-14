'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Feature, FeatureCollection } from 'geojson';
import type { Camera, CameraSource, MilitaryBase } from '@/lib/types';
import { SOURCE_META } from '@/lib/types';
import CameraPopup from './CameraPopup';
import { useStarlinkPositions } from './SatelliteOverlay';

// react-globe.gl uses three.js + DOM — must be client-only in Next.js.
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

type Props = {
  cameras: Camera[];
  enabledSources: Set<CameraSource>;
  showStarlink: boolean;
  showBases: boolean;
  onBasesCount?: (count: number) => void;
};

const COUNTRIES_URL = 'https://unpkg.com/world-atlas@2.0.2/countries-50m.json';
const ADMIN1_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';
const BASES_URL = '/api/military-bases';

const OCEAN_HEX = '#0b1220';
const LAND_HEX = '#1e293b';
const BORDER_HEX = '#64748b';
const ADMIN1_BORDER_HEX = '#475569';

const SAT_ALT_FRACTION = 550 / 6371;
const EARTH_RADIUS_M = 6_371_000;

type CamPoint = Camera & { __kind: 'cam' };
type BasePoint = MilitaryBase & { __kind: 'base' };
type SatPoint = { __kind: 'sat'; id: string; name: string; lat: number; lon: number };
type AnyPoint = CamPoint | BasePoint | SatPoint;

export default function CameraMap({
  cameras,
  enabledSources,
  showStarlink,
  showBases,
  onBasesCount,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [countries, setCountries] = useState<Feature[]>([]);
  const [admin1, setAdmin1] = useState<Feature[]>([]);
  const [bases, setBases] = useState<MilitaryBase[]>([]);
  const [basesLoading, setBasesLoading] = useState(false);
  const [basesError, setBasesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Camera | null>(null);
  const [selectedBase, setSelectedBase] = useState<MilitaryBase | null>(null);
  const [selectedSatId, setSelectedSatId] = useState<string | null>(null);
  const inflightRef = useRef(false);

  const visible = useMemo(
    () => cameras.filter((c) => enabledSources.has(c.source)),
    [cameras, enabledSources],
  );

  // Country + admin-1 polygons (one-time fetch).
  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRIES_URL)
      .then((r) => r.json() as Promise<Topology>)
      .then((topo) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as
          | FeatureCollection
          | Feature;
        const features = fc.type === 'FeatureCollection' ? fc.features : [fc];
        setCountries(features);
      })
      .catch(() => {});
    fetch(ADMIN1_URL)
      .then((r) => r.json() as Promise<FeatureCollection>)
      .then((fc) => {
        if (cancelled) return;
        setAdmin1(fc.features ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Military bases — lazy.
  useEffect(() => {
    if (!showBases || bases.length > 0 || inflightRef.current) return;
    inflightRef.current = true;
    setBasesLoading(true);
    setBasesError(null);
    let cancelled = false;
    fetch(BASES_URL)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { bases: MilitaryBase[] };
      })
      .then((json) => {
        if (cancelled) return;
        setBases(json.bases);
        onBasesCount?.(json.bases.length);
      })
      .catch((err) => {
        if (!cancelled) setBasesError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        inflightRef.current = false;
        if (!cancelled) setBasesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showBases, bases.length, onBasesCount]);

  const polygons = useMemo(() => {
    const tagged: Feature[] = [];
    for (const f of countries) tagged.push({ ...f, properties: { ...f.properties, __tier: 'country' } });
    for (const f of admin1) tagged.push({ ...f, properties: { ...f.properties, __tier: 'admin1' } });
    return tagged;
  }, [countries, admin1]);

  const { positions: satellites, getTrack } = useStarlinkPositions(showStarlink);

  const satTracks = useMemo(() => {
    if (!showStarlink || !selectedSatId) return [];
    const segments = getTrack(selectedSatId);
    if (!segments) return [];
    return segments.map((seg) =>
      seg.map(([lng, lat, altMeters]) => [lng, lat, altMeters / EARTH_RADIUS_M] as [
        number,
        number,
        number,
      ]),
    );
  }, [showStarlink, selectedSatId, getTrack, satellites]);

  useEffect(() => {
    if (selectedSatId && !satellites.some((s) => s.id === selectedSatId)) {
      setSelectedSatId(null);
    }
  }, [satellites, selectedSatId]);

  // Size the globe to the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build the three datasets separately so each one's object references stay
  // stable when only one of them updates. react-globe.gl diffs htmlElementsData
  // by object identity — recreating refs means recreating DOM elements, which
  // is the #1 perf cliff at scale (especially with satellites refreshing 1 Hz).
  const taggedCams: AnyPoint[] = useMemo(
    () => visible.map((c) => ({ ...c, __kind: 'cam' as const })),
    [visible],
  );
  const taggedBases: AnyPoint[] = useMemo(
    () => (showBases ? bases.map((b) => ({ ...b, __kind: 'base' as const })) : []),
    [showBases, bases],
  );
  // Per-satellite refs cached in a Map so each tick mutates the existing entry
  // (lat/lng update) instead of allocating a fresh object. Otherwise the diff
  // throws away every satellite's DOM element every second.
  const satMapRef = useRef(new Map<string, SatPoint>());
  const taggedSats: AnyPoint[] = useMemo(() => {
    const map = satMapRef.current;
    if (!showStarlink) {
      if (map.size > 0) map.clear();
      return [];
    }
    const seen = new Set<string>();
    const out: SatPoint[] = [];
    for (const s of satellites) {
      seen.add(s.id);
      let existing = map.get(s.id);
      if (existing) {
        existing.lat = s.lat;
        existing.lon = s.lng;
      } else {
        existing = { __kind: 'sat', id: s.id, name: s.name, lat: s.lat, lon: s.lng };
        map.set(s.id, existing);
      }
      out.push(existing);
    }
    // Drop refs for satellites that fell out of the feed.
    for (const id of Array.from(map.keys())) {
      if (!seen.has(id)) map.delete(id);
    }
    return out;
  }, [showStarlink, satellites]);
  const htmlPoints: AnyPoint[] = useMemo(
    () => [...taggedCams, ...taggedBases, ...taggedSats],
    [taggedCams, taggedBases, taggedSats],
  );

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', height: '100vh', width: '100%', background: OCEAN_HEX }}
    >
      <Globe
        width={size.width}
        height={size.height}
        backgroundColor={OCEAN_HEX}
        showAtmosphere
        atmosphereColor="#38bdf8"
        atmosphereAltitude={0.12}
        globeImageUrl={null}
        showGlobe
        polygonsData={polygons}
        // altitude=0 → flat surface polygons (no extruded side walls), which
        // are dramatically cheaper to render than the previous tiny-extrusion
        // versions. Borders still show via polygonStrokeColor.
        polygonAltitude={0}
        polygonCapColor={() => LAND_HEX}
        polygonSideColor={() => LAND_HEX}
        polygonStrokeColor={(d: object) => {
          const tier = (d as Feature).properties?.__tier as string | undefined;
          return tier === 'admin1' ? ADMIN1_BORDER_HEX : BORDER_HEX;
        }}
        polygonsTransitionDuration={0}
        htmlElementsData={htmlPoints}
        htmlLat={(d: object) => (d as AnyPoint).lat}
        htmlLng={(d: object) => (d as AnyPoint).lon}
        htmlAltitude={(d: object) => {
          const p = d as AnyPoint;
          if (p.__kind === 'sat') return SAT_ALT_FRACTION;
          return 0.003;
        }}
        htmlElement={(d: object) => {
          const p = d as AnyPoint;
          // Two-layer pattern: outer transparent "hit zone" (~16 px source)
          // catches clicks; inner element is the actual visible dot. Since
          // CSS3D scales both layers together, the hit area stays much larger
          // than the dot at every zoom level — clicks register anywhere
          // within the bigger box even when the visible dot is sub-pixel.
          const hit = document.createElement('div');
          hit.style.cssText = `
            width: 16px; height: 16px;
            transform: translate(-50%, -50%);
            cursor: pointer;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
          `;
          const dot = document.createElement('div');
          dot.style.pointerEvents = 'none';
          if (p.__kind === 'cam') {
            const color = SOURCE_META[(p as CamPoint).source].color;
            dot.style.cssText = `
              width: 3px; height: 3px;
              background: ${color};
              border-radius: 50%;
              opacity: 0.85;
              pointer-events: none;
            `;
            hit.addEventListener('click', (ev) => {
              ev.stopPropagation();
              setSelected(p as Camera);
              setSelectedBase(null);
              setSelectedSatId(null);
            });
          } else if (p.__kind === 'base') {
            dot.style.cssText = `
              width: 5px; height: 5px;
              background: #ef4444;
              opacity: 0.9;
              pointer-events: none;
            `;
            hit.addEventListener('click', (ev) => {
              ev.stopPropagation();
              setSelectedBase(p as MilitaryBase);
              setSelected(null);
              setSelectedSatId(null);
            });
          } else {
            const sel = (p as SatPoint).id === selectedSatId;
            dot.style.cssText = `
              width: ${sel ? 4 : 2}px; height: ${sel ? 4 : 2}px;
              background: ${sel ? '#67e8f9' : '#38f8f8'};
              border-radius: 50%;
              opacity: ${sel ? 1 : 0.7};
              pointer-events: none;
            `;
            hit.addEventListener('click', (ev) => {
              ev.stopPropagation();
              setSelectedSatId((p as SatPoint).id);
              setSelected(null);
              setSelectedBase(null);
            });
          }
          hit.appendChild(dot);
          return hit;
        }}
        // Intentionally do NOT pass htmlElementVisibilityModifier. Without it,
        // three-globe sets obj.visible based on its own behind-the-globe check,
        // and CSS3DRenderer honors that — hiding back-hemisphere dots natively
        // (and freeing us from doing it ourselves).
        // Disable position tweens — at 10k+ elements the per-frame
        // interpolation is the dominant CPU cost.
        htmlTransitionDuration={0}
        pathsData={satTracks}
        pathPoints={(d: object) => d as Array<[number, number, number]>}
        pathPointLat={(pt: object) => (pt as [number, number, number])[1]}
        pathPointLng={(pt: object) => (pt as [number, number, number])[0]}
        pathPointAlt={(pt: object) => (pt as [number, number, number])[2]}
        pathColor={() => '#67e8f9'}
        pathStroke={1.2}
        pathTransitionDuration={0}
      />

      {showStarlink && satellites.length > 0 && (
        <Pill tone="muted" text={`${satellites.length.toLocaleString()} Starlink · 1 Hz`} />
      )}
      {showBases && (basesLoading || basesError) && (
        <Pill
          tone={basesError ? 'error' : 'muted'}
          text={basesError ? `Bases failed: ${basesError}` : 'Loading military bases…'}
          offsetTop={showStarlink && satellites.length > 0 ? 44 : 12}
        />
      )}

      {selectedBase && (
        <Card border="rgba(239, 68, 68, 0.4)" onClose={() => setSelectedBase(null)}>
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              color: '#fca5a5',
              letterSpacing: 0.6,
            }}
          >
            Military base
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2, color: '#e2e8f0' }}>
            {selectedBase.name}
          </div>
          {selectedBase.country && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              {selectedBase.country}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
            {selectedBase.lat.toFixed(4)}, {selectedBase.lon.toFixed(4)} ·{' '}
            <a
              href={selectedBase.id}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#fca5a5', textDecoration: 'none' }}
            >
              Wikidata ↗
            </a>
          </div>
        </Card>
      )}

      {selected && (
        <Card border="rgba(148, 163, 184, 0.3)" onClose={() => setSelected(null)}>
          <CameraPopup camera={selected} />
        </Card>
      )}
    </div>
  );
}

function Pill({
  text,
  tone,
  offsetTop = 12,
}: {
  text: string;
  tone: 'muted' | 'error';
  offsetTop?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: offsetTop,
        right: 12,
        zIndex: 1000,
        background: tone === 'error' ? 'rgba(127,29,29,0.92)' : 'rgba(15,23,42,0.92)',
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

function Card({
  children,
  border,
  onClose,
}: {
  children: React.ReactNode;
  border: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 56,
        zIndex: 500,
        background: 'rgba(15, 23, 42, 0.96)',
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        maxWidth: 380,
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: 'transparent',
          border: 0,
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 16,
          padding: 2,
        }}
        aria-label="Close"
      >
        ×
      </button>
      {children}
    </div>
  );
}

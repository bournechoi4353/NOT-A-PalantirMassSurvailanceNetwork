'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Feature, FeatureCollection } from 'geojson';
import type { Camera, CameraSource, MilitaryBase } from '@/lib/types';
import { SOURCE_META } from '@/lib/types';
import CameraPopup from './CameraPopup';
import { useStarlinkPositions } from './SatelliteOverlay';
import type { SatPosition } from '@/lib/satellites';

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

// three-globe renders everything in a sphere of radius 100 (GLOBE_RADIUS).
// We position satellite sprites in that same space ourselves.
const GLOBE_RADIUS = 100;
const DEG2RAD = Math.PI / 180;
function polar2Cartesian(lat: number, lng: number, altFraction: number) {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (90 - lng) * DEG2RAD;
  const r = GLOBE_RADIUS * (1 + altFraction);
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ] as const;
}

type CamPoint = Camera & { __kind: 'cam' };
type BasePoint = MilitaryBase & { __kind: 'base' };
type AnyPoint = CamPoint | BasePoint;

const CAM_ALT = 0.004;
const CAM_RADIUS = 0.16;
const BASE_RADIUS = 0.26;

// Satellites render as a single flat-square THREE.Points sprite cloud — one
// draw call, no per-point geometry (cameras/bases use three-globe's cylinder
// points; satellites move every 2s so a cheap sprite buffer is far faster and
// keeps them off the static cam/base layer entirely).
type SatDatum = { sats: SatPosition[] };
function buildSatPoints(sats: SatPosition[]): THREE.Points {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(Math.max(sats.length, 1) * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x38f8f8,
    size: 2.4, // pixels (sizeAttenuation off → constant on-screen square)
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
    depthWrite: false, // occluded by the opaque globe via depthTest, no z-fight
  });
  const pts = new THREE.Points(geom, mat);
  pts.frustumCulled = false;
  updateSatPoints(pts, sats);
  return pts;
}
function updateSatPoints(obj: THREE.Object3D, sats: SatPosition[]) {
  const pts = obj as THREE.Points;
  const geom = pts.geometry as THREE.BufferGeometry;
  let attr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!attr || attr.array.length < sats.length * 3) {
    attr = new THREE.BufferAttribute(new Float32Array(Math.max(sats.length, 1) * 3), 3);
    geom.setAttribute('position', attr);
  }
  const arr = attr.array as Float32Array;
  for (let i = 0; i < sats.length; i++) {
    const [x, y, z] = polar2Cartesian(sats[i].lat, sats[i].lng, SAT_ALT_FRACTION);
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  geom.setDrawRange(0, sats.length);
  attr.needsUpdate = true;
  geom.computeBoundingSphere();
}

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
  const inflightRef = useRef(false);
  // Pause satellite propagation while the user is dragging the globe — the
  // 60 Hz camera move is starving the main thread of cycles for SGP4.
  const draggingRef = useRef(false);

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

  const { positions: satellites } = useStarlinkPositions(showStarlink, draggingRef);

  // Single stable datum for the satellite sprite layer. We mutate `.sats` in
  // place and hand three-globe a fresh single-element array each tick: the new
  // array ref makes react-globe re-run the layer, but the stable element makes
  // it call customThreeObjectUpdate (in-place buffer write) instead of
  // rebuilding/leaking the THREE.Points object.
  const satDatumRef = useRef<SatDatum>({ sats: [] });
  satDatumRef.current.sats = satellites;
  const satLayerData = useMemo<SatDatum[]>(
    () => (showStarlink && satellites.length > 0 ? [satDatumRef.current] : []),
    [showStarlink, satellites],
  );

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

  // Pause satellite propagation during ANY camera interaction — drag, wheel
  // zoom, AND the inertia/damping spin that continues after release. A single
  // "settle" timer covers all three: each interaction event marks us busy and
  // (re)arms a timer that resumes propagation ~450ms after the last event,
  // which is past OrbitControls' damping decay (dampingFactor 0.1 ≈ ~300ms+).
  const settleTimerRef = useRef<number | null>(null);
  const bumpInteraction = useCallback(() => {
    draggingRef.current = true;
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      draggingRef.current = false;
      settleTimerRef.current = null;
    }, 450);
  }, []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const down = () => {
      draggingRef.current = true;
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('wheel', bumpInteraction, { passive: true });
    window.addEventListener('pointerup', bumpInteraction);
    window.addEventListener('pointercancel', bumpInteraction);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('wheel', bumpInteraction);
      window.removeEventListener('pointerup', bumpInteraction);
      window.removeEventListener('pointercancel', bumpInteraction);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };
  }, [bumpInteraction]);

  // Cameras + bases render on three-globe's GPU pointsData layer. Previously
  // these were ~20k DOM nodes on htmlElementsData (CSS3DRenderer transformed
  // every one each frame → ~1fps on drag); GPU points are one draw call.
  // Satellites are NOT here — they live on their own sprite layer (see
  // satLayerData) so their 2s updates never touch this static geometry.
  const taggedCams = useMemo<CamPoint[]>(
    () => visible.map((c) => ({ ...c, __kind: 'cam' as const })),
    [visible],
  );
  const taggedBases = useMemo<BasePoint[]>(
    () => (showBases ? bases.map((b) => ({ ...b, __kind: 'base' as const })) : []),
    [showBases, bases],
  );
  const allPoints = useMemo<AnyPoint[]>(
    () => [...taggedCams, ...taggedBases],
    [taggedCams, taggedBases],
  );

  // Stable accessor identities. The component re-renders every 2s (satellite
  // tick); inline closures would get a new identity each time, making react-
  // globe.gl re-digest BOTH the points layer and all ~250 polygons on every
  // tick (and on every selection change). useCallback pins them so only the
  // data that actually changed drives work. Only pointColor depends on state.
  const polygonAltitude = useCallback(
    (d: object) =>
      ((d as Feature).properties?.__tier as string | undefined) === 'admin1'
        ? 0.0006
        : 0.0003,
    [],
  );
  const polygonCapColor = useCallback(() => LAND_HEX, []);
  const polygonStrokeColor = useCallback(
    (d: object) =>
      ((d as Feature).properties?.__tier as string | undefined) === 'admin1'
        ? ADMIN1_BORDER_HEX
        : BORDER_HEX,
    [],
  );
  const pointLat = useCallback((d: object) => (d as AnyPoint).lat, []);
  const pointLng = useCallback((d: object) => (d as AnyPoint).lon, []);
  const pointAltitude = useCallback(() => CAM_ALT, []);
  const pointRadius = useCallback(
    (d: object) => ((d as AnyPoint).__kind === 'base' ? BASE_RADIUS : CAM_RADIUS),
    [],
  );
  const pointColor = useCallback((d: object) => {
    const p = d as AnyPoint;
    return p.__kind === 'cam' ? SOURCE_META[p.source].color : '#ef4444';
  }, []);
  const onPointClick = useCallback((d: object) => {
    const p = d as AnyPoint;
    if (p.__kind === 'cam') {
      setSelected(p as Camera);
      setSelectedBase(null);
    } else {
      setSelectedBase(p as MilitaryBase);
      setSelected(null);
    }
  }, []);
  const onPointHover = useCallback((d: object | null) => {
    const el = containerRef.current;
    if (el) el.style.cursor = d ? 'pointer' : 'default';
  }, []);

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
<<<<<<< HEAD
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
=======
        polygonAltitude={polygonAltitude}
        polygonCapColor={polygonCapColor}
        // No side walls. At these micro-altitudes the extruded torso is
        // invisible, but admin-1 (~294 regions, ~68k contour verts) generates
        // ~400k+ side-wall indices rasterized every frame. Dropping sides is a
        // pure per-frame GPU win; caps remain for the land fill. Returning
        // undefined sets hasSide=false in three-globe, skipping torso geometry.
        polygonSideColor={() => undefined as unknown as string}
        polygonStrokeColor={polygonStrokeColor}
        polygonsTransitionDuration={0}
        // Single GPU layer for cameras + bases + satellites. Back-hemisphere
        // points are occluded natively: the opaque globe sphere writes depth,
        // so points behind it fail the depth test (no manual hiding needed).
        pointsData={allPoints}
        pointLat={pointLat}
        pointLng={pointLng}
        pointAltitude={pointAltitude}
        pointRadius={pointRadius}
        pointResolution={4}
        pointColor={pointColor}
        pointsTransitionDuration={0}
        onPointClick={onPointClick}
        onPointHover={onPointHover}
        onZoom={bumpInteraction}
        // Satellites: a single flat-square THREE.Points sprite cloud, updated
        // in place every 2s. Decoupled from the cam/base points layer.
        customLayerData={satLayerData}
        customThreeObject={(d: object) => buildSatPoints((d as SatDatum).sats)}
        customThreeObjectUpdate={(obj: object, d: object) =>
          updateSatPoints(obj as THREE.Object3D, (d as SatDatum).sats)
        }
>>>>>>> d6826ed9ae9032560dc8256788d4dac4768fc10b
      />

      {showStarlink && satellites.length > 0 && (
        <Pill tone="muted" text={`${satellites.length.toLocaleString()} Starlink · 0.5 Hz`} />
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

'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Camera, CameraSource } from '@/lib/types';
import { SOURCE_META } from '@/lib/types';
import CameraPopup from './CameraPopup';

type Props = {
  cameras: Camera[];
  enabledSources: Set<CameraSource>;
};

const iconCache = new Map<string, L.DivIcon>();

function iconFor(source: CameraSource): L.DivIcon {
  const cached = iconCache.get(source);
  if (cached) return cached;
  const color = SOURCE_META[source].color;
  const icon = L.divIcon({
    className: 'cam-marker',
    html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,0.85);box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
  iconCache.set(source, icon);
  return icon;
}

function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 100 ? 44 : count < 1000 ? 52 : 60;
  const fontSize = count < 100 ? 13 : 12;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      display:flex;align-items:center;justify-content:center;
      background:rgba(15,23,42,0.85);
      color:#e2e8f0;
      border:2px solid rgba(255,255,255,0.7);
      border-radius:50%;
      font-family:system-ui,sans-serif;
      font-weight:700;font-size:${fontSize}px;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      backdrop-filter:blur(2px);
    ">${count.toLocaleString()}</div>`,
    className: 'cam-cluster',
    iconSize: L.point(size, size),
  });
}

export default function CameraMap({ cameras, enabledSources }: Props) {
  const visible = useMemo(
    () => cameras.filter((c) => enabledSources.has(c.source)),
    [cameras, enabledSources],
  );

  return (
    <MapContainer
      center={[30, 0]}
      zoom={2}
      style={{ height: '100vh', width: '100%', background: '#0b1220' }}
      preferCanvas
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup
        chunkedLoading
        chunkInterval={120}
        chunkDelay={40}
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={60}
        iconCreateFunction={clusterIcon}
      >
        {visible.map((cam) => (
          <Marker key={cam.id} position={[cam.lat, cam.lon]} icon={iconFor(cam.source)}>
            <Popup minWidth={360}>
              <CameraPopup camera={cam} />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

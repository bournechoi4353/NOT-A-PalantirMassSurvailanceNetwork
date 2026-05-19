'use client';

import type { Camera } from '@/lib/types';
import { SOURCE_META } from '@/lib/types';
import LivePlayer from './LivePlayer';

export default function CameraPopup({ camera }: { camera: Camera }) {
  const meta = SOURCE_META[camera.source];

  return (
    <div style={{ width: 360, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: meta.color,
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8' }}>
          {meta.label}
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#e2e8f0' }}>
        {camera.title}
      </div>

      <LivePlayer camera={camera} />

      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: '#94a3b8',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {camera.city ?? ''}
          {camera.country ? ` · ${camera.country}` : ''}
        </span>
        {(camera.externalUrl || camera.videoUrl || camera.embedUrl) && (
          <a
            href={camera.externalUrl ?? camera.videoUrl ?? camera.embedUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: meta.color, textDecoration: 'none', fontWeight: 600 }}
          >
            Open ↗
          </a>
        )}
      </div>
    </div>
  );
}

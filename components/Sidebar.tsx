'use client';

import { useEffect, useState } from 'react';
import type { Camera, CameraRegion, CameraSource } from '@/lib/types';
import { REGION_META, SOURCE_META } from '@/lib/types';

type Props = {
  cameras: Camera[];
  errors: Record<string, string>;
  enabledSources: Set<CameraSource>;
  onToggle: (source: CameraSource) => void;
  showStarlink: boolean;
  onToggleStarlink: () => void;
  showBases: boolean;
  onToggleBases: () => void;
  basesCount: number | null;
};

function groupedSources(): Array<[CameraRegion, CameraSource[]]> {
  const byRegion = new Map<CameraRegion, CameraSource[]>();
  for (const key of Object.keys(SOURCE_META) as CameraSource[]) {
    const region = SOURCE_META[key].region;
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region)!.push(key);
  }
  return Array.from(byRegion.entries()).sort(
    (a, b) => REGION_META[a[0]].order - REGION_META[b[0]].order,
  );
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

export default function Sidebar({
  cameras,
  errors,
  enabledSources,
  onToggle,
  showStarlink,
  onToggleStarlink,
  showBases,
  onToggleBases,
  basesCount,
}: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  const counts = cameras.reduce<Record<string, number>>((acc, c) => {
    acc[c.source] = (acc[c.source] ?? 0) + 1;
    return acc;
  }, {});

  if (isMobile && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open filters"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.92)',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '10px 12px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>☰</span>
        <span>{cameras.length.toLocaleString()} cams</span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: isMobile ? 0 : 16,
        left: isMobile ? 0 : 16,
        right: isMobile ? 0 : 'auto',
        bottom: isMobile ? 'auto' : 'auto',
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.94)',
        color: '#e2e8f0',
        padding: '14px 16px',
        borderRadius: isMobile ? 0 : 8,
        minWidth: 240,
        maxWidth: isMobile ? '100%' : 280,
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
            PUBLIC CAM DASHBOARD
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            {cameras.length.toLocaleString()} cameras · click a pin to view
          </div>
        </div>
        {isMobile && (
          <button
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 0,
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        {groupedSources().map(([region, srcs]) => (
          <div key={region} style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                color: '#64748b',
                textTransform: 'uppercase',
                margin: '6px 0 2px',
              }}
            >
              {REGION_META[region].label}
            </div>
            {srcs.map((src) => {
              const meta = SOURCE_META[src];
              const count = counts[src] ?? 0;
              const enabled = enabledSources.has(src);
              return (
                <label
                  key={src}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    cursor: 'pointer',
                    opacity: enabled ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => onToggle(src)}
                    style={{ accentColor: meta.color }}
                  />
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: meta.color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 13 }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {count.toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 4, borderTop: '1px solid #1e293b', paddingTop: 6 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: '#64748b',
            textTransform: 'uppercase',
            margin: '4px 0 2px',
          }}
        >
          Satellites
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 0',
            cursor: 'pointer',
            opacity: showStarlink ? 1 : 0.5,
          }}
        >
          <input
            type="checkbox"
            checked={showStarlink}
            onChange={onToggleStarlink}
            style={{ accentColor: '#38f8f8' }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: '#38f8f8',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, fontSize: 13 }}>Starlink</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>~10k</span>
        </label>
      </div>

      <div style={{ marginTop: 4, borderTop: '1px solid #1e293b', paddingTop: 6 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: '#64748b',
            textTransform: 'uppercase',
            margin: '4px 0 2px',
          }}
        >
          Other
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 0',
            cursor: 'pointer',
            opacity: showBases ? 1 : 0.5,
          }}
        >
          <input
            type="checkbox"
            checked={showBases}
            onChange={onToggleBases}
            style={{ accentColor: '#ef4444' }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              background: '#ef4444',
              border: '1.5px solid #fff',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, fontSize: 13 }}>Military bases</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {basesCount !== null ? basesCount.toLocaleString() : showBases ? '…' : ''}
          </span>
        </label>
      </div>

      {Object.keys(errors).length > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid #334155',
            fontSize: 11,
            color: '#fca5a5',
          }}
        >
          {Object.entries(errors).map(([src, msg]) => (
            <div key={src}>
              <b>{src}:</b> {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

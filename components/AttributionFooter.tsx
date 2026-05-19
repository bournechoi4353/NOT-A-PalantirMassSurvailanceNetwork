'use client';

import { useState } from 'react';
import type { CameraSource } from '@/lib/types';
import { SOURCE_META } from '@/lib/types';

export default function AttributionFooter() {
  const [open, setOpen] = useState(false);
  const sources = Object.keys(SOURCE_META) as CameraSource[];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        zIndex: 1000,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 360,
      }}
    >
      {open && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.94)',
            color: '#e2e8f0',
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 11,
            lineHeight: 1.5,
            marginBottom: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, letterSpacing: 0.4 }}>
            DATA SOURCES & LICENCES
          </div>
          {sources.map((src) => {
            const meta = SOURCE_META[src];
            return (
              <div key={src} style={{ marginTop: 4 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: meta.color,
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                <span style={{ fontWeight: 600 }}>{meta.label}</span>
                {' — '}
                {meta.attributionUrl ? (
                  <a
                    href={meta.attributionUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#93c5fd', textDecoration: 'none' }}
                  >
                    {meta.attribution}
                  </a>
                ) : (
                  <span>{meta.attribution}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'rgba(15, 23, 42, 0.92)',
          color: '#94a3b8',
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {open ? 'Hide sources' : 'Sources & licences'}
      </button>
    </div>
  );
}

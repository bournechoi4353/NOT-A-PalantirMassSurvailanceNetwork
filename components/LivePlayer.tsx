'use client';

import { useEffect, useRef, useState } from 'react';
import type { Camera } from '@/lib/types';

type Mode = 'hls' | 'mp4-loop' | 'snapshot' | 'iframe' | 'none';

function pickMode(cam: Camera): Mode {
  if (cam.videoUrl?.endsWith('.m3u8')) return 'hls';
  if (cam.videoUrl?.endsWith('.mp4')) return 'mp4-loop';
  if (cam.snapshotUrl) return 'snapshot';
  if (cam.embedUrl) return 'iframe';
  return 'none';
}

export default function LivePlayer({ camera }: { camera: Camera }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [snapshotKey, setSnapshotKey] = useState(Date.now());
  const mode = pickMode(camera);

  // HLS playback
  useEffect(() => {
    if (mode !== 'hls' || !camera.videoUrl) return;
    const video = videoRef.current;
    if (!video) return;

    let hls: import('hls.js').default | null = null;
    let cancelled = false;

    const start = async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = camera.videoUrl!;
        return;
      }
      const Hls = (await import('hls.js')).default;
      if (cancelled) return;
      if (!Hls.isSupported()) {
        setStatus('error');
        return;
      }
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(camera.videoUrl!);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setStatus('error');
      });
    };

    start();
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [camera.videoUrl, mode]);

  // MP4 loop: reload the src periodically so we always see the latest clip
  useEffect(() => {
    if (mode !== 'mp4-loop' || !camera.videoUrl) return;
    const video = videoRef.current;
    if (!video) return;
    video.src = camera.videoUrl;
    const interval = (camera.refreshSeconds ?? 60) * 1000;
    const id = setInterval(() => {
      video.src = `${camera.videoUrl}?t=${Date.now()}`;
      video.play().catch(() => {});
    }, interval);
    return () => clearInterval(id);
  }, [camera.videoUrl, camera.refreshSeconds, mode]);

  // Snapshot polling
  useEffect(() => {
    if (mode !== 'snapshot') return;
    const interval = (camera.refreshSeconds ?? 60) * 1000;
    const id = setInterval(() => setSnapshotKey(Date.now()), interval);
    return () => clearInterval(id);
  }, [mode, camera.refreshSeconds]);

  const liveBadge = (label: string) => (
    <span
      style={{
        position: 'absolute',
        top: 6,
        left: 6,
        background: 'rgba(220,38,38,0.9)',
        color: 'white',
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 3,
        letterSpacing: 0.5,
        zIndex: 1,
      }}
    >
      ● {label}
    </span>
  );

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    background: '#000',
    borderRadius: 4,
    overflow: 'hidden',
    aspectRatio: '16 / 9',
  };

  if (mode === 'hls' || mode === 'mp4-loop') {
    return (
      <div style={containerStyle}>
        {status !== 'error' && liveBadge(mode === 'hls' ? 'LIVE' : 'NEAR-LIVE')}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          loop={mode === 'mp4-loop'}
          controls
          onPlaying={() => setStatus('playing')}
          onError={() => setStatus('error')}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        {status === 'error' && (
          <FallbackSnapshot camera={camera} snapshotKey={snapshotKey} />
        )}
      </div>
    );
  }

  if (mode === 'snapshot') {
    return (
      <div style={containerStyle}>
        {liveBadge('SNAPSHOT')}
        <FallbackSnapshot camera={camera} snapshotKey={snapshotKey} />
      </div>
    );
  }

  if (mode === 'iframe') {
    return (
      <div style={containerStyle}>
        <iframe
          src={camera.embedUrl}
          style={{ width: '100%', height: '100%', border: 0 }}
          allow="autoplay; fullscreen"
        />
      </div>
    );
  }

  return <EmptyState camera={camera} message="No inline preview available." />;
}

function FallbackSnapshot({
  camera,
  snapshotKey,
}: {
  camera: Camera;
  snapshotKey: number;
}) {
  if (!camera.snapshotUrl) {
    return <EmptyState camera={camera} message="Stream unavailable." inset />;
  }
  const src = `${camera.snapshotUrl}${camera.snapshotUrl.includes('?') ? '&' : '?'}t=${snapshotKey}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={camera.title}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}

function EmptyState({
  camera,
  message,
  inset = false,
}: {
  camera: Camera;
  message: string;
  inset?: boolean;
}) {
  const link = camera.externalUrl ?? camera.videoUrl ?? camera.embedUrl;
  return (
    <div
      style={{
        position: inset ? 'absolute' : 'relative',
        inset: inset ? 0 : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 18,
        background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
        borderRadius: 4,
        minHeight: inset ? undefined : 140,
        color: '#94a3b8',
        textAlign: 'center',
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        style={{ opacity: 0.6 }}
      >
        <rect x="3" y="6" width="14" height="12" rx="2" />
        <path d="M17 10l4-2v8l-4-2z" />
        <line x1="3" y1="3" x2="21" y2="21" stroke="#dc2626" strokeWidth="2" />
      </svg>
      <div style={{ fontSize: 12 }}>{message}</div>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          style={{
            marginTop: 4,
            fontSize: 12,
            color: '#60a5fa',
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid #334155',
            borderRadius: 4,
          }}
        >
          Open externally ↗
        </a>
      )}
    </div>
  );
}

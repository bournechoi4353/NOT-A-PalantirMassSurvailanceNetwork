'use client';

export default function MapSkeleton() {
  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        background:
          'radial-gradient(ellipse at center, #0f172a 0%, #0b1220 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.06,
        }}
      >
        <defs>
          <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#cbd5e1" strokeWidth="0.1" />
          </pattern>
        </defs>
        <rect width="100" height="60" fill="url(#grid)" />
      </svg>

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '14px 16px',
          borderRadius: 8,
          minWidth: 240,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <SkeletonBar width={140} height={12} />
        <SkeletonBar width={180} height={9} mt={8} />
        <div style={{ marginTop: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}
            >
              <SkeletonBar width={14} height={14} radius={3} />
              <SkeletonBar width={10} height={10} radius={5} />
              <SkeletonBar width={140} height={11} />
              <div style={{ flex: 1 }} />
              <SkeletonBar width={24} height={10} />
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#64748b',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        Loading cameras…
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200px 0;
          }
          100% {
            background-position: 200px 0;
          }
        }
      `}</style>
    </div>
  );
}

function SkeletonBar({
  width,
  height,
  mt = 0,
  radius = 4,
}: {
  width: number;
  height: number;
  mt?: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        marginTop: mt,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, #1e293b 0%, #334155 50%, #1e293b 100%)',
        backgroundSize: '400px 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

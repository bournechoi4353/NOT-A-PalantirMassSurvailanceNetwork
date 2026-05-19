'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Camera, CameraSource } from '@/lib/types';
import { SOURCE_META } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import MapSkeleton from '@/components/MapSkeleton';

const CameraMap = dynamic(() => import('@/components/CameraMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

type Props = {
  cameras: Camera[];
  errors: Record<string, string>;
};

export default function Dashboard({ cameras, errors }: Props) {
  const allSources = useMemo(
    () => new Set(Object.keys(SOURCE_META) as CameraSource[]),
    [],
  );
  const [enabled, setEnabled] = useState<Set<CameraSource>>(allSources);

  const toggle = (src: CameraSource) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  };

  return (
    <main style={{ position: 'relative' }}>
      <CameraMap cameras={cameras} enabledSources={enabled} />
      <Sidebar
        cameras={cameras}
        errors={errors}
        enabledSources={enabled}
        onToggle={toggle}
      />
    </main>
  );
}

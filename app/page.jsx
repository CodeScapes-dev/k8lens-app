'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClusterStore } from '@/stores/clusterStore';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    useClusterStore.persist.rehydrate();
    const { clusters, activeContext } = useClusterStore.getState();
    const hasActive =
      activeContext && clusters.some((c) => c.contextName === activeContext);
    router.replace(hasActive ? '/dashboard' : '/connect');
  }, [router]);

  return null;
}

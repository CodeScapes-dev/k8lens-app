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
    router.replace(hasActive ? '/workloads/deployments' : '/connect');
  }, [router]);

  return (
    <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--foreground)', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

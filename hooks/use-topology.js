"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { clusterHeaders } from "@/hooks/use-k8s";

export function useTopology(options = {}) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);

  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const { namespace, includeClusterScoped = true } = options;

  const fetchTopology = React.useCallback(async () => {
    if (!activeContext) return;
    setLoading(true);
    setError(null);
    try {
      const cluster = clusters.find((c) => c.contextName === activeContext);
      const params = new URLSearchParams({ context: activeContext });
      if (namespace) params.set("namespace", namespace);
      if (!includeClusterScoped) params.set("includeClusterScoped", "false");

      const res = await fetch(`/api/k8s/topology?${params}`, {
        headers: clusterHeaders(cluster),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err?.message ?? "Failed to load topology");
    } finally {
      setLoading(false);
    }
  }, [activeContext, clusters, namespace, includeClusterScoped]);

  React.useEffect(() => {
    React.startTransition(() => { fetchTopology(); });
  }, [fetchTopology]);

  return { data, loading, error, refresh: fetchTopology };
}

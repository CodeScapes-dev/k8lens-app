"use client";
import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { clusterHeaders } from "@/hooks/use-k8s";

export function useMetrics(path, { enabled = true } = {}) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);
  const [state, setState] = React.useState({ available: null, data: null, loading: false });

  React.useEffect(() => {
    if (!enabled || !activeContext || !path) {
      setState({ available: null, data: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ available: null, data: null, loading: true });
    const cluster = clusters.find((c) => c.contextName === activeContext);
    fetch(path, { headers: clusterHeaders(cluster) })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setState({ available: json.available ?? false, data: json.data ?? null, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ available: false, data: null, loading: false });
      });
    return () => { cancelled = true; };
  }, [path, enabled, activeContext, clusters]);

  return state;
}

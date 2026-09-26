"use client";
import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { clusterHeaders } from "@/hooks/use-k8s";

export function useMetrics(path, { enabled = true } = {}) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);
  const autoRefresh = useClusterStore((s) => s.preferences?.autoRefresh ?? 0);
  const [state, setState] = React.useState({ available: null, data: null, loading: false });
  const requestId = React.useRef(0);

  // Background loads keep the current numbers on screen and ignore failures, so a refresh never blanks the charts.
  const load = React.useCallback(
    (background) => {
      const id = ++requestId.current;
      if (!enabled || !activeContext || !path) {
        setState({ available: null, data: null, loading: false });
        return;
      }
      if (!background) setState({ available: null, data: null, loading: true });
      const cluster = clusters.find((c) => c.contextName === activeContext);
      fetch(path, { headers: clusterHeaders(cluster) })
        .then((r) => r.json())
        .then((json) => {
          if (id === requestId.current) setState({ available: json.available ?? false, data: json.data ?? null, loading: false });
        })
        .catch(() => {
          if (id === requestId.current && !background) setState({ available: false, data: null, loading: false });
        });
    },
    [path, enabled, activeContext, clusters],
  );

  React.useEffect(() => {
    load(false);
    return () => {
      requestId.current++;
    };
  }, [load]);

  React.useEffect(() => {
    if (!autoRefresh || !enabled) return;
    const timer = setInterval(() => load(true), autoRefresh * 1000);
    return () => clearInterval(timer);
  }, [load, autoRefresh, enabled]);

  React.useEffect(() => {
    const onRefreshNow = () => load(true);
    window.addEventListener("kl:refresh-now", onRefreshNow);
    return () => window.removeEventListener("kl:refresh-now", onRefreshNow);
  }, [load]);

  return state;
}

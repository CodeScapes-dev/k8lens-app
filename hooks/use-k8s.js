"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useClusterStore } from "@/stores/clusterStore";
import { useLiveUpdates, useWatchInfo } from "@/hooks/use-live-updates";

export function clusterHeaders(cluster) {
  if (!cluster) return {};
  return {
    ...(cluster.server && { "x-cluster-server": cluster.server }),
    ...(cluster.token && { "x-cluster-token": cluster.token }),
    ...(cluster.caData && { "x-cluster-ca-data": cluster.caData }),
    ...(cluster.certData && { "x-cluster-cert-data": cluster.certData }),
    ...(cluster.keyData && { "x-cluster-key-data": cluster.keyData }),
    ...(cluster.skipTLSVerify !== undefined && {
      "x-cluster-skip-tls": String(cluster.skipTLSVerify),
    }),
  };
}

export function useK8sResource(apiGroup, resource, options = {}) {
  const router = useRouter();
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);
  const removeCluster = useClusterStore((s) => s.removeCluster);
  const autoRefresh = useClusterStore((s) => s.preferences?.autoRefresh ?? 0);
  const [data, setData] = React.useState([]);
  const [pagination, setPagination] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const isFirstFetch = React.useRef(true);
  const [watchInfo, updateWatchInfo] = useWatchInfo();

  const listParamsKey = JSON.stringify(options.listParams ?? {});
  const cluster = clusters.find((c) => c.contextName === activeContext);
  const headers = React.useMemo(() => clusterHeaders(cluster), [cluster]);

  // mode: "auto" (first load or poll/manual refresh) | "live" (a watched dependency changed — silent)
  const fetchData = React.useCallback(async (mode = "auto") => {
    if (!activeContext) return;
    const isLive = mode === "live";
    const isBackground = !isFirstFetch.current;
    if (!isLive) {
      if (isBackground) setRefreshing(true);
      else setLoading(true);
    }
    try {
      const params = new URLSearchParams({ context: activeContext });
      if (resource) params.set("resource", resource);
      if (options.namespace) params.set("namespace", options.namespace);
      if (options.listParams) {
        const lp = options.listParams;
        if (lp.page) params.set("page", String(lp.page));
        if (lp.limit) params.set("limit", String(lp.limit));
        if (lp.search) params.set("search", lp.search);
        if (lp.sortBy) params.set("sortBy", lp.sortBy);
        if (lp.sortOrder) params.set("sortOrder", lp.sortOrder);
        if (lp.status) params.set("status", lp.status);
        if (lp.node) params.set("node", lp.node);
      }
      const res = await fetch(`/api/k8s/${apiGroup}?${params}`, { headers });
      const json = await res.json();
      if (!res.ok) {
        const err = json.error;
        if (err?.code === 'CLUSTER_UNREACHABLE') {
          removeCluster(activeContext);
          router.replace('/connect');
          return;
        }
        throw new Error(err?.message ?? err ?? "Request failed");
      }
      setData(json.data || []);
      setPagination(json.pagination || null);
      setError(null);
      updateWatchInfo(res);
      isFirstFetch.current = false;
      if (isBackground && !isLive) window.dispatchEvent(new CustomEvent("kl:refreshed"));
    } catch (err) {
      // A failed live refetch keeps the last good data on screen.
      if (!isLive) setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContext, headers, apiGroup, resource, options.namespace, listParamsKey]);

  const liveRefetch = React.useCallback(() => fetchData("live"), [fetchData]);
  const { live } = useLiveUpdates({
    deps: watchInfo.deps,
    refetch: liveRefetch,
    headers,
    enabled: watchInfo.source !== "rest",
  });
  // "mixed" responses include data the cache couldn't serve, so keep polling for those.
  const fullyLive = live && watchInfo.source === "watch";

  React.useEffect(() => {
    isFirstFetch.current = true;
  }, [fetchData]);

  React.useEffect(() => {
    React.startTransition(() => { fetchData(); });
  }, [fetchData]);

  // Interval polling is only a fallback for when the live stream isn't available.
  React.useEffect(() => {
    if (!autoRefresh || fullyLive) return;
    const id = setInterval(() => fetchData(), autoRefresh * 1000);
    return () => clearInterval(id);
  }, [fetchData, autoRefresh, fullyLive]);

  React.useEffect(() => {
    const onRefreshNow = () => fetchData();
    window.addEventListener("kl:refresh-now", onRefreshNow);
    return () => window.removeEventListener("kl:refresh-now", onRefreshNow);
  }, [fetchData]);

  return { data, loading, refreshing, error, refresh: fetchData, pagination, live };
}

export function useK8sDetail(type, namespace, name) {
  const router = useRouter();
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);
  const removeCluster = useClusterStore((s) => s.removeCluster);
  const autoRefresh = useClusterStore((s) => s.preferences?.autoRefresh ?? 0);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const hasLoaded = React.useRef(false);
  const [watchInfo, updateWatchInfo] = useWatchInfo();
  const cluster = clusters.find((c) => c.contextName === activeContext);
  const headers = React.useMemo(() => clusterHeaders(cluster), [cluster]);

  const fetchData = React.useCallback(async (mode = "auto") => {
    if (!activeContext || !name) return;
    const isLive = mode === "live";
    const isBackground = hasLoaded.current;
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams({ type, name, context: activeContext });
      if (namespace) params.set("namespace", namespace);
      const res = await fetch(`/api/k8s/detail?${params}`, { headers });
      const json = await res.json();
      if (!res.ok) {
        const err = json.error;
        if (err?.code === 'CLUSTER_UNREACHABLE') {
          removeCluster(activeContext);
          router.replace('/connect');
          return;
        }
        throw new Error(err?.message ?? err ?? "Request failed");
      }
      setData(json);
      setError(null);
      updateWatchInfo(res);
      hasLoaded.current = true;
      if (isBackground && !isLive) window.dispatchEvent(new CustomEvent("kl:refreshed"));
    } catch (err) {
      if (!isLive) setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContext, headers, type, namespace, name]);

  const liveRefetch = React.useCallback(() => fetchData("live"), [fetchData]);
  const { live } = useLiveUpdates({
    deps: watchInfo.deps,
    refetch: liveRefetch,
    headers,
    enabled: watchInfo.source !== "rest",
  });
  // "mixed" responses include data the cache couldn't serve, so keep polling for those.
  const fullyLive = live && watchInfo.source === "watch";

  React.useEffect(() => {
    hasLoaded.current = false;
  }, [activeContext, type, namespace, name]);

  React.useEffect(() => {
    React.startTransition(() => { fetchData(); });
  }, [fetchData]);

  React.useEffect(() => {
    if (!autoRefresh || fullyLive) return;
    const id = setInterval(() => fetchData(), autoRefresh * 1000);
    return () => clearInterval(id);
  }, [fetchData, autoRefresh, fullyLive]);

  React.useEffect(() => {
    const onRefreshNow = () => fetchData();
    window.addEventListener("kl:refresh-now", onRefreshNow);
    return () => window.removeEventListener("kl:refresh-now", onRefreshNow);
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData, live };
}

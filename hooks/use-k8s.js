"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useClusterStore } from "@/stores/clusterStore";

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

  const listParamsKey = JSON.stringify(options.listParams ?? {});

  const fetchData = React.useCallback(async () => {
    if (!activeContext) return;
    const isBackground = !isFirstFetch.current;
    if (isBackground) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const cluster = clusters.find((c) => c.contextName === activeContext);
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
      const res = await fetch(`/api/k8s/${apiGroup}?${params}`, {
        headers: clusterHeaders(cluster),
      });
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
      isFirstFetch.current = false;
      if (isBackground) window.dispatchEvent(new CustomEvent("kl:refreshed"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContext, clusters, apiGroup, resource, options.namespace, listParamsKey]);

  React.useEffect(() => {
    isFirstFetch.current = true;
  }, [fetchData]);

  React.useEffect(() => {
    React.startTransition(() => { fetchData(); });
  }, [fetchData]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [fetchData, autoRefresh]);

  return { data, loading, refreshing, error, refresh: fetchData, pagination };
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

  const fetchData = React.useCallback(async () => {
    if (!activeContext || !name) return;
    setLoading(true);
    setError(null);
    try {
      const cluster = clusters.find((c) => c.contextName === activeContext);
      const params = new URLSearchParams({ type, name, context: activeContext });
      if (namespace) params.set("namespace", namespace);
      const res = await fetch(`/api/k8s/detail?${params}`, {
        headers: clusterHeaders(cluster),
      });
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContext, clusters, type, namespace, name]);

  React.useEffect(() => {
    React.startTransition(() => { fetchData(); });
  }, [fetchData]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [fetchData, autoRefresh]);

  return { data, loading, error, refresh: fetchData };
}

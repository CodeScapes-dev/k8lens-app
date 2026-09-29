"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useClusterStore } from "@/stores/clusterStore";
import { useK8sSubscription } from "@/hooks/use-k8s-subscription";
import { clusterHeaders } from "@/hooks/cluster-headers";
import { WATCH_KINDS, DETAIL_TYPE_TO_KIND } from "@/lib/k8s/watch-kinds";

export { clusterHeaders };

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

  // Reset the fallback once the user navigates to a different resource/cluster, so a past RBAC
  // failure on one kind doesn't permanently disable live updates for an unrelated one.
  const isWatchable = WATCH_KINDS[resource]?.apiGroup === apiGroup;
  const [degraded, setDegraded] = React.useState(false);
  React.useEffect(() => { setDegraded(false); }, [apiGroup, resource, activeContext]);

  useK8sSubscription(isWatchable ? resource : null, {
    enabled: isWatchable && !degraded,
    onChange: fetchData,
    onDegraded: () => setDegraded(true),
  });

  React.useEffect(() => {
    if (!autoRefresh) return;
    // Live updates already cover this kind; polling on top would be redundant network/API load.
    if (isWatchable && !degraded) return;
    const id = setInterval(fetchData, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [fetchData, autoRefresh, isWatchable, degraded]);

  React.useEffect(() => {
    const onRefreshNow = () => fetchData();
    window.addEventListener("kl:refresh-now", onRefreshNow);
    return () => window.removeEventListener("kl:refresh-now", onRefreshNow);
  }, [fetchData]);

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
  // The object genuinely doesn't exist (already gone, or deleted while this page was open) —
  // distinct from `error`, which is a fetch/API problem. Pages show a "this was deleted" dialog
  // instead of freezing on stale data, since a 404 here means there is nothing left to refresh.
  const [notFound, setNotFound] = React.useState(false);
  const hasLoaded = React.useRef(false);

  const fetchData = React.useCallback(async () => {
    if (!activeContext || !name) return;
    const isBackground = hasLoaded.current;
    if (!isBackground) setLoading(true);
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
        if (err?.code === 'NOT_FOUND') {
          setNotFound(true);
          setData(null);
          hasLoaded.current = true;
          return;
        }
        throw new Error(err?.message ?? err ?? "Request failed");
      }
      setNotFound(false);
      setData(json);
      hasLoaded.current = true;
      if (isBackground) window.dispatchEvent(new CustomEvent("kl:refreshed"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContext, clusters, type, namespace, name]);

  React.useEffect(() => {
    hasLoaded.current = false;
    setNotFound(false);
  }, [activeContext, type, namespace, name]);

  React.useEffect(() => {
    React.startTransition(() => { fetchData(); });
  }, [fetchData]);

  // Detail pages subscribe to the whole kind (there's no per-object watch), but only refetch when
  // the change was to *this* object — otherwise every other pod's churn on a busy cluster would
  // refetch every open pod detail page. Cluster-scoped objects have no namespace on either side.
  const watchKind = DETAIL_TYPE_TO_KIND[type];
  const isWatchable = Boolean(watchKind);
  const [degraded, setDegraded] = React.useState(false);
  React.useEffect(() => { setDegraded(false); }, [type, namespace, name, activeContext]);

  useK8sSubscription(isWatchable ? watchKind : null, {
    enabled: isWatchable && !degraded && !notFound,
    filter: (obj) => (obj?.metadata?.namespace || null) === (namespace || null) && obj?.metadata?.name === name,
    onChange: fetchData,
    onDegraded: () => setDegraded(true),
  });

  React.useEffect(() => {
    if (!autoRefresh || notFound) return;
    if (isWatchable && !degraded) return;
    const id = setInterval(fetchData, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [fetchData, autoRefresh, isWatchable, degraded, notFound]);

  React.useEffect(() => {
    const onRefreshNow = () => { if (!notFound) fetchData(); };
    window.addEventListener("kl:refresh-now", onRefreshNow);
    return () => window.removeEventListener("kl:refresh-now", onRefreshNow);
  }, [fetchData, notFound]);

  return { data, loading, error, notFound, refresh: fetchData };
}

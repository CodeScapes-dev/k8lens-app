"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useClusterStore } from "@/stores/clusterStore";
import { clusterHeaders } from "@/hooks/use-k8s";
import { calculateClusterHealthScore } from "@/lib/k8s/cluster-health-score";
import { aggregatePodsByPhase, aggregateNodeHealth, aggregateWorkloadHealth, aggregateRecentEvents, aggregatePodRestarts, buildUnhealthyWorkloads } from "@/lib/k8s/dashboard-aggregations";
import { calculateClusterCost, calculateNamespaceCosts } from "@/lib/k8s/cost-calculations";

export function useDashboardData() {
  const router = useRouter();
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);
  const removeCluster = useClusterStore((s) => s.removeCluster);
  const autoRefresh = useClusterStore((s) => s.preferences?.autoRefresh ?? 0);

  const [raw, setRaw] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const isFirstFetch = React.useRef(true);

  const fetchData = React.useCallback(async () => {
    if (!activeContext) return;
    const isBackground = !isFirstFetch.current;
    if (isBackground) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const cluster = clusters.find((c) => c.contextName === activeContext);
      const params = new URLSearchParams({ context: activeContext });
      const res = await fetch(`/api/k8s/dashboard?${params}`, { headers: clusterHeaders(cluster) });
      const json = await res.json();
      if (!res.ok) {
        const err = json.error;
        if (err?.code === "CLUSTER_UNREACHABLE") {
          removeCluster(activeContext);
          router.replace("/connect");
          return;
        }
        throw new Error(err?.message ?? err ?? "Request failed");
      }
      setRaw(json);
      isFirstFetch.current = false;
      if (isBackground) window.dispatchEvent(new CustomEvent("kl:refreshed"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContext, clusters]);

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

  const aggregated = React.useMemo(() => {
    if (!raw) return null;
    const { nodes, pods, deployments, statefulSets, daemonSets, events, jobs, cronJobs, ingresses, services, namespaces } = raw;
    const healthScore = calculateClusterHealthScore(raw);
    const podPhases = aggregatePodsByPhase(pods);
    const nodeHealth = aggregateNodeHealth(nodes);
    const workloads = aggregateWorkloadHealth(deployments, statefulSets, daemonSets);
    const restarts = aggregatePodRestarts(pods);
    const eventStats = aggregateRecentEvents(events, 60);
    const unhealthyWorkloads = buildUnhealthyWorkloads(pods, deployments, statefulSets, daemonSets);
    const totalMonthlyCost = calculateClusterCost(pods);
    const namespaceCosts = calculateNamespaceCosts(pods);
    return {
      healthScore,
      pods: { ...podPhases, total: pods.length, restarts: restarts.totalRestarts, crashLoopCount: restarts.crashLoopPods.length },
      nodes: { ...nodeHealth },
      workloads,
      events: eventStats,
      unhealthyWorkloads,
      cost: { totalMonthlyCost, namespaceCosts: namespaceCosts.slice(0, 8) },
      topology: {
        deployments: deployments.length,
        statefulSets: statefulSets.length,
        daemonSets: daemonSets.length,
        jobs: jobs.length,
        cronJobs: cronJobs.length,
        services: services.length,
        ingresses: ingresses.length,
        namespaces: namespaces.length,
      },
    };
  }, [raw]);

  return { raw, aggregated, loading, refreshing, error, refresh: fetchData };
}

"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource, clusterHeaders } from "@/hooks/use-k8s";
import { useMetrics } from "@/hooks/use-metrics";
import { useClusterStore } from "@/stores/clusterStore";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { nodeColumns } from "@/lib/k8s/columns/cluster";
import { fmtCores, fmtMilliStr, fmtGB, fmtMB } from "@/lib/k8s/metrics-utils";
import { MetricValue } from "@/components/kl/MetricValue";

const dash = <span style={{ color: "var(--kl-text-faint)" }}>—</span>;

function StatusSummary({ data }) {
  const c = React.useMemo(() => {
    const r = { Ready: 0, NotReady: 0 };
    for (const d of data) {
      const ready = (d.status?.conditions || []).find((x) => x.type === "Ready");
      if (ready?.status === "True") r.Ready++; else r.NotReady++;
    }
    return r;
  }, [data]);
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {[{ l: "Ready", v: c.Ready, c: "var(--kl-ok)" }, { l: "Not Ready", v: c.NotReady, c: "var(--kl-err)" }].map((s) => (
        <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
          <span className="kl-mono" style={{ color: "var(--kl-text)", fontWeight: 600, fontSize: 13 }}>{s.v}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>{s.l}</span>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc" });
  const [viewMode, setViewMode] = React.useState("Table");

  const { data, loading, refreshing, error, pagination } = useK8sResource("core", "nodes", { listParams });

  // Primary: Metrics Server
  const { available: msAvailable, data: metricsData } = useMetrics("/api/k8s/metrics/nodes");

  // Fallback: per-node kubelet stats when Metrics Server is unavailable
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters      = useClusterStore((s) => s.clusters);
  const [nodeStatsFallback, setNodeStatsFallback] = React.useState({});

  React.useEffect(() => {
    if (msAvailable !== false || data.length === 0) return;
    const cluster = clusters.find((c) => c.contextName === activeContext);
    const hdrs = clusterHeaders(cluster);
    Promise.all(
      data.map((node) =>
        fetch(`/api/k8s/node-stats/${node.metadata.name}`, { headers: hdrs })
          .then((r) => r.json())
          .then((json) => ({ name: node.metadata.name, json }))
          .catch(() => ({ name: node.metadata.name, json: { available: false } }))
      )
    ).then((results) => {
      const map = {};
      for (const { name, json } of results) {
        if (json.available && json.data?.cpu) {
          map[name] = {
            cpu:    Math.round(json.data.cpu.usageNanoCores / 1_000_000),
            memory: json.data.memory?.workingSetBytes ?? null,
          };
        }
      }
      setNodeStatsFallback(map);
    });
  }, [msAvailable, data, clusters, activeContext]);

  const metricsMap = React.useMemo(() => {
    const m = {};
    for (const n of (metricsData ?? [])) m[n.name] = n;
    // overlay fallback only for nodes not already covered by MS
    for (const [name, stats] of Object.entries(nodeStatsFallback)) {
      if (!m[name]) m[name] = stats;
    }
    return m;
  }, [metricsData, nodeStatsFallback]);

  const metricsColumns = React.useMemo(() => [
    {
      id: "cpu",
      header: "CPU",
      accessorFn: (row) => metricsMap[row.metadata?.name]?.cpu ?? null,
      meta: { mono: true, muted: true, w: "0.7fr" },
      cell: (info) => {
        const v = info.getValue();
        return v != null
          ? <MetricValue display={fmtCores(v)} hover={fmtMilliStr(v)} className="font-mono text-[var(--kl-text-muted)]" />
          : dash;
      },
    },
    {
      id: "memory",
      header: "Memory",
      accessorFn: (row) => metricsMap[row.metadata?.name]?.memory ?? null,
      meta: { mono: true, muted: true, w: "0.9fr" },
      cell: (info) => {
        const v = info.getValue();
        return v != null
          ? <MetricValue display={fmtGB(v)} hover={fmtMB(v)} className="font-mono text-[var(--kl-text-muted)]" />
          : dash;
      },
    },
  ], [metricsMap]);

  const columns = React.useMemo(() => [...nodeColumns, ...metricsColumns], [metricsColumns]);

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Nodes" count={pagination?.totalItems} subtitle="v1 · core · cluster-scoped"><StatusSummary data={data} /></PageHeader>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={columns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} footerText="Live · watching v1 · nodes" viewMode={viewMode} onViewModeChange={setViewMode} onRowClick={(r) => router.push(`/cluster/nodes/${r.metadata.name}`)} />
    </div>
  );
}

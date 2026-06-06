"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { podColumns } from "@/lib/k8s/columns/core";
import { getPodStatus } from "@/lib/k8s/utils";
import { useMetrics } from "@/hooks/use-metrics";
import { fmtCores, fmtMilliStr, fmtGB, fmtMB } from "@/lib/k8s/metrics-utils";
import { MetricValue } from "@/components/kl/MetricValue";

const dash = <span style={{ color: "var(--kl-text-faint)" }}>—</span>;

function useElapsed() {
  const [secs, setSecs] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m`;
}

function computePodCounts(data) {
  const counts = { Running: 0, Pending: 0, Failed: 0 };
  for (const pod of data) {
    const s = getPodStatus(pod);
    if (s === "Running" || s === "Completed" || s === "Succeeded") counts.Running++;
    else if (s === "Pending" || s === "ContainerCreating") counts.Pending++;
    else counts.Failed++;
  }
  return counts;
}

export default function PodsPage() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({
    page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc",
  });
  const [viewMode, setViewMode] = React.useState("Table");
  const [nsFilter, setNsFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("any");
  const [nodeFilter, setNodeFilter] = React.useState("any");

  const { data, loading, refreshing, error, pagination, refresh } = useK8sResource("core", "pods", { listParams, namespace: nsFilter === "all" ? undefined : nsFilter });
  const { data: metricsData } = useMetrics(`/api/k8s/metrics/pods${nsFilter !== "all" ? `?namespace=${nsFilter}` : ""}`);
  const elapsed = useElapsed();
  const counts = computePodCounts(data);

  const metricsMap = React.useMemo(() => {
    const m = {};
    for (const p of (metricsData ?? [])) m[`${p.namespace}/${p.name}`] = p;
    return m;
  }, [metricsData]);

  const metricsColumns = React.useMemo(() => [
    {
      id: "cpu",
      header: "CPU",
      meta: { mono: true, muted: true, w: "0.7fr" },
      cell: (info) => {
        const key = `${info.row.original.metadata?.namespace}/${info.row.original.metadata?.name}`;
        const v = metricsMap[key]?.cpu ?? null;
        return v != null
          ? <MetricValue display={fmtCores(v)} hover={fmtMilliStr(v)} className="font-mono text-[var(--kl-text-muted)]" />
          : dash;
      },
    },
    {
      id: "memory",
      header: "Memory",
      meta: { mono: true, muted: true, w: "0.9fr" },
      cell: (info) => {
        const key = `${info.row.original.metadata?.namespace}/${info.row.original.metadata?.name}`;
        const v = metricsMap[key]?.memory ?? null;
        return v != null
          ? <MetricValue display={fmtGB(v)} hover={fmtMB(v)} className="font-mono text-[var(--kl-text-muted)]" />
          : dash;
      },
    },
  ], [metricsMap]);

  const columns = React.useMemo(() => [...podColumns, ...metricsColumns], [metricsColumns]);

  // Derive unique namespaces/nodes from current page for filter options
  const seenNs = React.useRef(new Set());
  React.useEffect(() => { data.forEach((p) => { if (p.metadata?.namespace) seenNs.current.add(p.metadata.namespace); }); }, [data]);
  const namespaces = React.useMemo(() => {
    const ns = [...seenNs.current].sort();
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const nodes = React.useMemo(() => {
    const ns = [...new Set(data.map((p) => p.spec?.nodeName).filter(Boolean))];
    return [{ value: "any", label: "Any node" }, ...ns.map((n) => ({ value: n, label: n }))];
  }, [data]);

  const statusOptions = [
    { value: "any", label: "Any status" },
    { value: "Running", label: "Running" },
    { value: "Pending", label: "Pending" },
    { value: "Failed", label: "Failed" },
    { value: "CrashLoopBackOff", label: "CrashLoopBackOff" },
    { value: "Completed", label: "Completed" },
  ];

  const handleNsChange = (val) => {
    setNsFilter(val);
    setListParams((p) => ({ ...p, page: 1 }));
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setListParams((p) => ({ ...p, status: val === "any" ? "" : val, page: 1 }));
  };

  const handleNodeChange = (val) => {
    setNodeFilter(val);
    setListParams((p) => ({ ...p, node: val === "any" ? "" : val, page: 1 }));
  };

  const statusSummary = (
    <div style={{ display: "flex", gap: 16 }}>
      {[
        { l: "Running", v: counts.Running, c: "var(--kl-ok)" },
        { l: "Pending", v: counts.Pending, c: "var(--kl-warn)" },
        { l: "Failed", v: counts.Failed, c: "var(--kl-err)" },
      ].map((s) => (
        <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
          <span className="kl-mono" style={{ color: "var(--kl-text)", fontWeight: 600, fontSize: 13 }}>{s.v}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>{s.l}</span>
        </div>
      ))}
    </div>
  );

  const filterChips = (
    <>
      <FilterChip label="Namespace" value={nsFilter} onChange={handleNsChange} options={namespaces} />
      <FilterChip label="Status" value={statusFilter} onChange={handleStatusChange} options={statusOptions} />
      <FilterChip label="Node" value={nodeFilter} onChange={handleNodeChange} options={nodes} />
    </>
  );

  const kubectlCmd = nsFilter === "all"
    ? "kubectl get pods -A"
    : `kubectl get pods -n ${nsFilter}`;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Pods"
        count={pagination?.totalItems}
        subtitle="v1 · core · all namespaces"
        kubectlCmd={kubectlCmd}
        resourceKey="pods"
      >
        {statusSummary}
      </PageHeader>

      {error && (
        <div style={{
          marginBottom: 12, padding: "10px 14px",
          background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)",
          borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)",
        }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        refreshing={refreshing}
        pagination={pagination}
        listParams={listParams}
        onParamsChange={setListParams}
        filterChips={filterChips}
        footerText={`Live · watching v1/pods · ${elapsed}`} resourceKind="Pod"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRowClick={(pod) => router.push(`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`)}
      />
    </div>
  );
}

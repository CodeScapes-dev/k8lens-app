"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { podColumns } from "@/lib/k8s/columns/core";
import { getPodStatus } from "@/lib/k8s/utils";

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

  const { data, loading, refreshing, error, pagination, refresh } = useK8sResource("core", "pods", { listParams });
  const elapsed = useElapsed();
  const counts = computePodCounts(data);

  // Derive unique namespaces/nodes from current page for filter options
  const namespaces = React.useMemo(() => {
    const ns = [...new Set(data.map((p) => p.metadata?.namespace).filter(Boolean))];
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
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
    // namespace filter is handled server-side via listParams when we add namespace support
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

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Pods"
        count={pagination?.totalItems}
        subtitle="v1 · core · all namespaces"
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
        columns={podColumns}
        data={data}
        loading={loading}
        refreshing={refreshing}
        pagination={pagination}
        listParams={listParams}
        onParamsChange={setListParams}
        filterChips={filterChips}
        footerText={`Live · watching v1/pods · ${elapsed}`}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRowClick={(pod) => router.push(`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`)}
      />
    </div>
  );
}

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { deploymentColumns } from "@/lib/k8s/columns/apps";
import { useMetrics } from "@/hooks/use-metrics";
import { fmtCores, fmtMilliStr, fmtGB, fmtMB } from "@/lib/k8s/metrics-utils";
import { MetricValue } from "@/components/kl/MetricValue";

const dash = <span style={{ color: "var(--kl-text-faint)" }}>—</span>;

function StatusSummary({ data }) {
  const counts = React.useMemo(() => {
    const c = { Healthy: 0, Progressing: 0, Degraded: 0 };
    for (const d of data) {
      const desired = d.spec?.replicas ?? 0;
      const ready = d.status?.readyReplicas ?? 0;
      const updated = d.status?.updatedReplicas ?? 0;
      if (desired === 0 || (ready === desired && updated === desired)) c.Healthy++;
      else if (ready === 0) c.Degraded++;
      else c.Progressing++;
    }
    return c;
  }, [data]);
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {[{ l: "Healthy", v: counts.Healthy, c: "var(--kl-ok)" }, { l: "Progressing", v: counts.Progressing, c: "var(--kl-warn)" }, { l: "Degraded", v: counts.Degraded, c: "var(--kl-err)" }].map((s) => (
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
  const [nsFilter, setNsFilter] = React.useState("all");
  const { data, loading, refreshing, error, pagination } = useK8sResource("apps", "deployments", { listParams, namespace: nsFilter === "all" ? undefined : nsFilter });
  const { data: metricsData } = useMetrics("/api/k8s/metrics/workloads?kind=deployments");

  const metricsMap = React.useMemo(() => {
    const m = {};
    for (const r of (metricsData ?? [])) m[`${r.namespace}/${r.name}`] = r;
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
        return v != null ? <MetricValue display={fmtCores(v)} hover={fmtMilliStr(v)} className="font-mono text-[var(--kl-text-muted)]" /> : dash;
      },
    },
    {
      id: "memory",
      header: "Memory",
      meta: { mono: true, muted: true, w: "0.9fr" },
      cell: (info) => {
        const key = `${info.row.original.metadata?.namespace}/${info.row.original.metadata?.name}`;
        const v = metricsMap[key]?.memory ?? null;
        return v != null ? <MetricValue display={fmtGB(v)} hover={fmtMB(v)} className="font-mono text-[var(--kl-text-muted)]" /> : dash;
      },
    },
  ], [metricsMap]);

  const columns = React.useMemo(() => [...deploymentColumns, ...metricsColumns], [metricsColumns]);

  const seenNs = React.useRef(new Set());
  React.useEffect(() => { data.forEach((r) => { if (r.metadata?.namespace) seenNs.current.add(r.metadata.namespace); }); }, [data]);
  const namespaces = React.useMemo(() => {
    const ns = [...seenNs.current].sort();
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Deployments" count={pagination?.totalItems} subtitle="apps/v1 · all namespaces">
        <StatusSummary data={data} />
      </PageHeader>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={columns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} filterChips={<FilterChip label="Namespace" value={nsFilter} onChange={(v) => { setNsFilter(v); setListParams((p) => ({ ...p, page: 1 })); }} options={namespaces} />} footerText="Live · watching apps/v1 · deployments" resourceKind="Deployment" viewMode={viewMode} onViewModeChange={setViewMode} onRowClick={(dep) => router.push(`/workloads/deployments/${dep.metadata.namespace}/${dep.metadata.name}`)} />
    </div>
  );
}

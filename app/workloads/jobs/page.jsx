"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { jobColumns } from "@/lib/k8s/columns/batch";
import { useMetrics } from "@/hooks/use-metrics";
import { fmtCores, fmtMilliStr, fmtGB, fmtMB } from "@/lib/k8s/metrics-utils";
import { MetricValue } from "@/components/kl/MetricValue";

const dash = <span style={{ color: "var(--kl-text-faint)" }}>—</span>;

function StatusSummary({ data }) {
  const c = React.useMemo(() => {
    const r = { Complete: 0, Running: 0, Failed: 0 };
    for (const d of data) {
      const conds = d.status?.conditions || [];
      if (conds.find((x) => x.type === "Complete" && x.status === "True")) r.Complete++;
      else if (conds.find((x) => x.type === "Failed" && x.status === "True")) r.Failed++;
      else r.Running++;
    }
    return r;
  }, [data]);
  return <div style={{ display: "flex", gap: 16 }}>{[{ l: "Complete", v: c.Complete, c: "var(--kl-ok)" }, { l: "Running", v: c.Running, c: "var(--kl-warn)" }, { l: "Failed", v: c.Failed, c: "var(--kl-err)" }].map((s) => (<div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} /><span className="kl-mono" style={{ color: "var(--kl-text)", fontWeight: 600, fontSize: 13 }}>{s.v}</span><span style={{ color: "var(--kl-text-muted)" }}>{s.l}</span></div>))}</div>;
}

export default function Page() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc" });
  const [viewMode, setViewMode] = React.useState("Table");
  const [nsFilter, setNsFilter] = React.useState("all");
  const { data, loading, refreshing, error, pagination } = useK8sResource("batch", "jobs", { listParams, namespace: nsFilter === "all" ? undefined : nsFilter });
  const { data: metricsData } = useMetrics("/api/k8s/metrics/workloads?kind=jobs");

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

  const columns = React.useMemo(() => [...jobColumns, ...metricsColumns], [metricsColumns]);

  const seenNs = React.useRef(new Set());
  React.useEffect(() => { data.forEach((r) => { if (r.metadata?.namespace) seenNs.current.add(r.metadata.namespace); }); }, [data]);
  const namespaces = React.useMemo(() => {
    const ns = [...seenNs.current].sort();
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const kubectlCmd = nsFilter === "all"
    ? "kubectl get jobs -A"
    : `kubectl get jobs -n ${nsFilter}`;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Jobs" count={pagination?.totalItems} subtitle="batch/v1 · all namespaces" kubectlCmd={kubectlCmd} resourceKey="jobs"><StatusSummary data={data} /></PageHeader>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={columns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} filterChips={<FilterChip label="Namespace" value={nsFilter} onChange={(v) => { setNsFilter(v); setListParams((p) => ({ ...p, page: 1 })); }} options={namespaces} />} footerText="Live · watching batch/v1 · jobs" resourceKind="Job" viewMode={viewMode} onViewModeChange={setViewMode} onRowClick={(r) => router.push(`/workloads/jobs/${r.metadata.namespace}/${r.metadata.name}`)} />
    </div>
  );
}

"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { pvcColumns } from "@/lib/k8s/columns/storage";

const STATUS_OPTIONS = [
  { value: "any", label: "Any status" },
  { value: "Bound", label: "Bound" },
  { value: "Pending", label: "Pending" },
  { value: "Lost", label: "Lost" },
];

function StatusSummary({ data }) {
  const c = React.useMemo(() => {
    const r = { Bound: 0, Pending: 0, Lost: 0 };
    for (const d of data) { const s = d.status?.phase; if (r[s] !== undefined) r[s]++; }
    return r;
  }, [data]);
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {[{ l: "Bound", v: c.Bound, c: "var(--kl-ok)" }, { l: "Pending", v: c.Pending, c: "var(--kl-warn)" }, { l: "Lost", v: c.Lost, c: "var(--kl-err)" }].map((s) => (
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
  const [statusFilter, setStatusFilter] = React.useState("any");
  const { data, loading, refreshing, error, pagination } = useK8sResource("core", "persistentvolumeclaims", { listParams });
  const namespaces = React.useMemo(() => { const ns = [...new Set(data.map((r) => r.metadata?.namespace).filter(Boolean))]; return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))]; }, [data]);
  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Persistent Volume Claims" count={pagination?.totalItems} subtitle="v1 · core · all namespaces"><StatusSummary data={data} /></PageHeader>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={pvcColumns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} filterChips={<><FilterChip label="Namespace" value={nsFilter} onChange={setNsFilter} options={namespaces} /><FilterChip label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} /></>} footerText="Live · watching v1 · persistentvolumeclaims" onRowClick={(r) => router.push(`/storage/persistentvolumeclaims/${r.metadata.namespace}/${r.metadata.name}`)} viewMode={viewMode} onViewModeChange={setViewMode} />
    </div>
  );
}

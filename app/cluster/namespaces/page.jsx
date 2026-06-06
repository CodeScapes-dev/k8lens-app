"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { namespaceColumns } from "@/lib/k8s/columns/cluster";

function StatusSummary({ data }) {
  const c = React.useMemo(() => {
    const r = { Active: 0, Terminating: 0 };
    for (const d of data) { const s = d.status?.phase; if (s === "Active") r.Active++; else r.Terminating++; }
    return r;
  }, [data]);
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {[{ l: "Active", v: c.Active, c: "var(--kl-ok)" }, { l: "Terminating", v: c.Terminating, c: "var(--kl-warn)" }].map((s) => (
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
  const { data, loading, refreshing, error, pagination } = useK8sResource("core", "namespaces", { listParams });
  const kubectlCmd = "kubectl get namespaces";

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Namespaces" count={pagination?.totalItems} subtitle="v1 · core · cluster-scoped" kubectlCmd={kubectlCmd} resourceKey="namespaces"><StatusSummary data={data} /></PageHeader>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={namespaceColumns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} footerText="Live · watching v1 · namespaces" onRowClick={(r) => router.push(`/cluster/namespaces/${r.metadata.name}`)} viewMode={viewMode} onViewModeChange={setViewMode} />
    </div>
  );
}

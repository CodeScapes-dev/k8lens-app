"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { nodeColumns } from "@/lib/k8s/columns/cluster";

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
  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Nodes" count={pagination?.totalItems} subtitle="v1 · core · cluster-scoped"><StatusSummary data={data} /></PageHeader>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={nodeColumns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} footerText="Live · watching v1 · nodes" viewMode={viewMode} onViewModeChange={setViewMode} onRowClick={(r) => router.push(`/cluster/nodes/${r.metadata.name}`)} />
    </div>
  );
}

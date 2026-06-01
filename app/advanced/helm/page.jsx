"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { helmReleaseColumns } from "@/lib/k8s/columns/helm";

function StatusSummary({ data }) {
  const counts = React.useMemo(() => {
    const c = { Deployed: 0, Failed: 0, Pending: 0 };
    for (const r of data) {
      const phase = r.status?.phase ?? "unknown";
      if (phase === "deployed") c.Deployed++;
      else if (phase === "failed") c.Failed++;
      else c.Pending++;
    }
    return c;
  }, [data]);
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {[
        { l: "Deployed", v: counts.Deployed, c: "var(--kl-ok)" },
        { l: "Failed", v: counts.Failed, c: "var(--kl-err)" },
        { l: "Pending", v: counts.Pending, c: "var(--kl-warn)" },
      ].map((s) => (
        <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
          <span className="kl-mono" style={{ color: "var(--kl-text)", fontWeight: 600, fontSize: 13 }}>{s.v}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>{s.l}</span>
        </div>
      ))}
    </div>
  );
}

export default function HelmReleasesPage() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 20, search: "", sortBy: "name", sortOrder: "asc" });
  const [nsFilter, setNsFilter] = React.useState("all");
  const { data, loading, refreshing, error, pagination } = useK8sResource("helm", "releases", {
    listParams,
    ...(nsFilter !== "all" ? { namespace: nsFilter } : {}),
  });
  const namespaces = React.useMemo(() => {
    const ns = [...new Set(data.map((r) => r.metadata?.namespace).filter(Boolean))];
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
  }, [data]);

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Helm Releases" count={pagination?.totalItems} subtitle="helm.sh/release.v1 · all namespaces">
        <StatusSummary data={data} />
      </PageHeader>
      {error && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>
          {error}
        </div>
      )}
      <DataTable
        columns={helmReleaseColumns}
        data={data}
        loading={loading}
        refreshing={refreshing}
        pagination={pagination}
        listParams={listParams}
        onParamsChange={setListParams}
        filterChips={<FilterChip label="Namespace" value={nsFilter} onChange={setNsFilter} options={namespaces} />}
        footerText="Live · watching helm.sh/release.v1 secrets"
        emptyText="This cluster has no Helm releases. Deploy a chart with helm install to get started."
        onRowClick={(r) => router.push(`/advanced/helm/${r.metadata.namespace}/${r.metadata.name}`)}
      />
    </div>
  );
}

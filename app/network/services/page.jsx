"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { serviceColumns } from "@/lib/k8s/columns/networking";

const TYPE_OPTIONS = [
  { value: "any", label: "Any type" },
  { value: "ClusterIP", label: "ClusterIP" },
  { value: "NodePort", label: "NodePort" },
  { value: "LoadBalancer", label: "LoadBalancer" },
  { value: "ExternalName", label: "ExternalName" },
];

function StatusSummary({ data }) {
  const c = React.useMemo(() => {
    const r = { ClusterIP: 0, NodePort: 0, LoadBalancer: 0 };
    for (const d of data) {
      const t = d.spec?.type ?? "ClusterIP";
      if (r[t] !== undefined) r[t]++; else r.ClusterIP++;
    }
    return r;
  }, [data]);
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {[{ l: "ClusterIP", v: c.ClusterIP, c: "var(--kl-text-muted)" }, { l: "NodePort", v: c.NodePort, c: "var(--kl-warn)" }, { l: "LoadBalancer", v: c.LoadBalancer, c: "var(--kl-info)" }].map((s) => (
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
  const [typeFilter, setTypeFilter] = React.useState("any");
  const { data, loading, refreshing, error, pagination } = useK8sResource("core", "services", { listParams, namespace: nsFilter === "all" ? undefined : nsFilter });

  const seenNs = React.useRef(new Set());
  React.useEffect(() => { data.forEach((r) => { if (r.metadata?.namespace) seenNs.current.add(r.metadata.namespace); }); }, [data]);
  const namespaces = React.useMemo(() => {
    const ns = [...seenNs.current].sort();
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const kubectlCmd = nsFilter === "all"
    ? "kubectl get services -A"
    : `kubectl get services -n ${nsFilter}`;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Services" count={pagination?.totalItems} subtitle="v1 · core · all namespaces" kubectlCmd={kubectlCmd} resourceKey="services">
        <StatusSummary data={data} />
      </PageHeader>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable
        columns={serviceColumns}
        data={data}
        loading={loading}
        refreshing={refreshing}
        pagination={pagination}
        listParams={listParams}
        onParamsChange={setListParams}
        filterChips={
          <>
            <FilterChip label="Namespace" value={nsFilter} onChange={(v) => { setNsFilter(v); setListParams((p) => ({ ...p, page: 1 })); }} options={namespaces} />
            <FilterChip label="Type" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} />
          </>
        }
        footerText="Live · watching v1 · services" resourceKind="Service"
        onRowClick={(r) => router.push(`/network/services/${r.metadata.namespace}/${r.metadata.name}`)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}

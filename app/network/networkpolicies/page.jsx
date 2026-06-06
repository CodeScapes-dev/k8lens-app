"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { networkPolicyColumns } from "@/lib/k8s/columns/networking";

export default function Page() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc" });
  const [viewMode, setViewMode] = React.useState("Table");
  const [nsFilter, setNsFilter] = React.useState("all");
  const { data, loading, refreshing, error, pagination } = useK8sResource("networking", "networkpolicies", { listParams, namespace: nsFilter === "all" ? undefined : nsFilter });

  const seenNs = React.useRef(new Set());
  React.useEffect(() => { data.forEach((r) => { if (r.metadata?.namespace) seenNs.current.add(r.metadata.namespace); }); }, [data]);
  const namespaces = React.useMemo(() => {
    const ns = [...seenNs.current].sort();
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const kubectlCmd = nsFilter === "all"
    ? "kubectl get networkpolicies -A"
    : `kubectl get networkpolicies -n ${nsFilter}`;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Network Policies" count={pagination?.totalItems} subtitle="networking.k8s.io/v1 · all namespaces"  kubectlCmd={kubectlCmd} resourceKey="networkpolicies" />
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable
        columns={networkPolicyColumns}
        data={data}
        loading={loading}
        refreshing={refreshing}
        pagination={pagination}
        listParams={listParams}
        onParamsChange={setListParams}
        filterChips={<FilterChip label="Namespace" value={nsFilter} onChange={(v) => { setNsFilter(v); setListParams((p) => ({ ...p, page: 1 })); }} options={namespaces} />}
        footerText="Live · watching networking.k8s.io/v1 · networkpolicies" resourceKind="NetworkPolicy"
        onRowClick={(r) => router.push(`/network/networkpolicies/${r.metadata.namespace}/${r.metadata.name}`)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}

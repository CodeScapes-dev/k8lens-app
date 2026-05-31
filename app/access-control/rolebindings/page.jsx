"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { roleBindingColumns } from "@/lib/k8s/columns/rbac";

export default function Page() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc" });
  const [viewMode, setViewMode] = React.useState("Table");
  const [nsFilter, setNsFilter] = React.useState("all");
  const { data, loading, refreshing, error, pagination } = useK8sResource("rbac", "rolebindings", { listParams });
  const namespaces = React.useMemo(() => { const ns = [...new Set(data.map((r) => r.metadata?.namespace).filter(Boolean))]; return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))]; }, [data]);
  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Role Bindings" count={pagination?.totalItems} subtitle="rbac.authorization.k8s.io/v1 · all namespaces" />
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={roleBindingColumns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} filterChips={<FilterChip label="Namespace" value={nsFilter} onChange={setNsFilter} options={namespaces} />} footerText="Live · watching rbac/v1 · rolebindings" onRowClick={(r) => router.push(`/access-control/rolebindings/${r.metadata.namespace}/${r.metadata.name}`)} viewMode={viewMode} onViewModeChange={setViewMode} />
    </div>
  );
}

"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { clusterRoleBindingColumns } from "@/lib/k8s/columns/rbac";

export default function Page() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc" });
  const [viewMode, setViewMode] = React.useState("Table");
  const { data, loading, refreshing, error, pagination } = useK8sResource("rbac", "clusterrolebindings", { listParams });
  const kubectlCmd = "kubectl get clusterrolebindings";

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Cluster Role Bindings" count={pagination?.totalItems} subtitle="rbac.authorization.k8s.io/v1 · cluster-scoped"  kubectlCmd={kubectlCmd} resourceKey="clusterrolebindings" />
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={clusterRoleBindingColumns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} footerText="Live · watching rbac/v1 · clusterrolebindings" onRowClick={(r) => router.push(`/access-control/clusterrolebindings/${r.metadata.name}`)} viewMode={viewMode} onViewModeChange={setViewMode} />
    </div>
  );
}

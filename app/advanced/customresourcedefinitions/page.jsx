"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { crdColumns } from "@/lib/k8s/columns/advanced";

export default function Page() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc" });
  const [viewMode, setViewMode] = React.useState("Table");
  const { data, loading, refreshing, error, pagination } = useK8sResource("crds", null, { listParams });
  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Custom Resource Definitions" count={pagination?.totalItems} subtitle="apiextensions.k8s.io/v1 · cluster-scoped" />
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={crdColumns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} footerText="Live · watching apiextensions/v1 · customresourcedefinitions" onRowClick={(r) => router.push(`/advanced/customresourcedefinitions/${r.metadata.name}`)} viewMode={viewMode} onViewModeChange={setViewMode} />
    </div>
  );
}

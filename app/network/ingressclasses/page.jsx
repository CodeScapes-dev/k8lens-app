"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ingressClassColumns } from "@/lib/k8s/columns/networking";

export default function Page() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc" });
  const [viewMode, setViewMode] = React.useState("Table");
  const { data, loading, refreshing, error, pagination } = useK8sResource("networking", "ingressclasses", { listParams });

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Ingress Classes" count={pagination?.totalItems} subtitle="networking.k8s.io/v1 · cluster-scoped" />
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable
        columns={ingressClassColumns}
        data={data}
        loading={loading}
        refreshing={refreshing}
        pagination={pagination}
        listParams={listParams}
        onParamsChange={setListParams}
        footerText="Live · watching networking.k8s.io/v1 · ingressclasses"
        onRowClick={(r) => router.push(`/network/ingressclasses/${r.metadata.name}`)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}

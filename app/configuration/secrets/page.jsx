"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { secretColumns } from "@/lib/k8s/columns/core";

const SECRET_TYPE_OPTIONS = [
  { value: "any", label: "Any type" },
  { value: "Opaque", label: "Opaque" },
  { value: "kubernetes.io/service-account-token", label: "Service Account Token" },
  { value: "kubernetes.io/tls", label: "TLS" },
  { value: "kubernetes.io/dockerconfigjson", label: "Docker Config" },
];

export default function Page() {
  const router = useRouter();
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "name", sortOrder: "asc" });
  const [viewMode, setViewMode] = React.useState("Table");
  const [nsFilter, setNsFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("any");
  const { data, loading, refreshing, error, pagination } = useK8sResource("core", "secrets", { listParams, namespace: nsFilter === "all" ? undefined : nsFilter });

  const seenNs = React.useRef(new Set());
  React.useEffect(() => { data.forEach((r) => { if (r.metadata?.namespace) seenNs.current.add(r.metadata.namespace); }); }, [data]);
  const namespaces = React.useMemo(() => {
    const ns = [...seenNs.current].sort();
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Secrets" count={pagination?.totalItems} subtitle="v1 · core · all namespaces" />
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable
        columns={secretColumns}
        data={data}
        loading={loading}
        refreshing={refreshing}
        pagination={pagination}
        listParams={listParams}
        onParamsChange={setListParams}
        filterChips={
          <>
            <FilterChip label="Namespace" value={nsFilter} onChange={(v) => { setNsFilter(v); setListParams((p) => ({ ...p, page: 1 })); }} options={namespaces} />
            <FilterChip label="Type" value={typeFilter} onChange={setTypeFilter} options={SECRET_TYPE_OPTIONS} />
          </>
        }
        footerText="Live · watching v1 · secrets" resourceKind="Secret"
        onRowClick={(r) => router.push(`/configuration/secrets/${r.metadata.namespace}/${r.metadata.name}`)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}

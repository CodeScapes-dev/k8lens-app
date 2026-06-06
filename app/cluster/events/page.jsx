"use client";
import React from "react";
import { useK8sResource } from "@/hooks/use-k8s";
import { DataTable, FilterChip } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { eventColumns } from "@/lib/k8s/columns/cluster";
import { EventDetailDialog } from "@/components/cluster/EventDetailDialog";

const TYPE_OPTIONS = [
  { value: "any", label: "Any type" },
  { value: "Normal", label: "Normal" },
  { value: "Warning", label: "Warning" },
];

function StatusSummary({ data }) {
  const c = React.useMemo(() => {
    const r = { Normal: 0, Warning: 0 };
    for (const d of data) { if (d.type === "Warning") r.Warning++; else r.Normal++; }
    return r;
  }, [data]);
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {[{ l: "Normal", v: c.Normal, c: "var(--kl-ok)" }, { l: "Warning", v: c.Warning, c: "var(--kl-warn)" }].map((s) => (
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
  const [listParams, setListParams] = React.useState({ page: 1, limit: 5, search: "", sortBy: "age", sortOrder: "desc" });
  const [viewMode, setViewMode] = React.useState("Table");
  const [nsFilter, setNsFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("any");
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const { data, loading, refreshing, error, pagination } = useK8sResource("events", null, { listParams, namespace: nsFilter === "all" ? undefined : nsFilter });
  const { data: allData } = useK8sResource("events", null, { listParams: { page: 1, limit: 500, sortBy: "age", sortOrder: "desc" } });
  const namespaces = React.useMemo(() => {
    const ns = [...new Set(allData.map((r) => r.metadata?.namespace).filter(Boolean))].sort();
    return [{ value: "all", label: "All namespaces" }, ...ns.map((n) => ({ value: n, label: n }))];
  }, [allData]);
  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Events" count={pagination?.totalItems} subtitle="events.k8s.io/v1 · all namespaces"><StatusSummary data={data} /></PageHeader>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12.5, color: "var(--kl-err)" }}>{error}</div>}
      <DataTable columns={eventColumns} data={data} loading={loading} refreshing={refreshing} pagination={pagination} listParams={listParams} onParamsChange={setListParams} onRowClick={setSelectedEvent} filterChips={<><FilterChip label="Namespace" value={nsFilter} onChange={(v) => { setNsFilter(v); setListParams((p) => ({ ...p, page: 1 })); }} options={namespaces} /><FilterChip label="Type" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} /></>} footerText="Live · watching events.k8s.io/v1" resourceKind="Event" viewMode={viewMode} onViewModeChange={setViewMode} />
      {selectedEvent && <EventDetailDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}

import React from "react";
import { KLStatus } from "@/components/kl/Status";
import { ageCol, TimestampCell } from "./_shared";

// ─── Nodes ────────────────────────────────────────────────────────────────────

function nodeStatusKind(node) {
  const ready = (node.status?.conditions || []).find((c) => c.type === "Ready");
  return ready?.status === "True" ? "ok" : "err";
}

export const nodeColumns = [
  {
    id: "name", header: "Name", accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2fr)", sortable: true },
    cell: (info) => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <KLStatus kind={nodeStatusKind(info.row.original)} dotOnly />
        <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span>
      </div>
    ),
  },
  {
    id: "status", header: "Status",
    accessorFn: (row) => { const r = (row.status?.conditions || []).find((c) => c.type === "Ready"); return r?.status === "True" ? "Ready" : "NotReady"; },
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => <KLStatus kind={info.getValue() === "Ready" ? "ok" : "err"}>{info.getValue()}</KLStatus>,
  },
  {
    id: "roles", header: "Roles",
    accessorFn: (row) => {
      const labels = row.metadata?.labels || {};
      const roles = Object.keys(labels).filter((k) => k.startsWith("node-role.kubernetes.io/")).map((k) => k.split("/")[1]);
      return roles.length > 0 ? roles.join(", ") : "worker";
    },
    meta: { mono: true, muted: true, w: "0.8fr" },
  },
  { id: "version", header: "Version", accessorFn: (row) => row.status?.nodeInfo?.kubeletVersion ?? "—", meta: { mono: true, muted: true, w: "0.9fr" } },
  { id: "os", header: "OS", accessorFn: (row) => row.status?.nodeInfo?.osImage ?? "—", meta: { muted: true, w: "1.2fr" } },
  { id: "arch", header: "Arch", accessorFn: (row) => row.status?.nodeInfo?.architecture ?? "—", meta: { mono: true, muted: true, w: "0.6fr" } },
  { id: "internalIP", header: "Internal IP", accessorFn: (row) => (row.status?.addresses || []).find((a) => a.type === "InternalIP")?.address ?? "—", meta: { mono: true, muted: true, w: "1fr" } },
  ageCol(),
];

// ─── Namespaces ───────────────────────────────────────────────────────────────

export const namespaceColumns = [
  {
    id: "name", header: "Name", accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2.5fr)", sortable: true },
    cell: (info) => {
      const phase = info.row.original.status?.phase;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <KLStatus kind={phase === "Active" ? "ok" : "warn"} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span>
        </div>
      );
    },
  },
  {
    id: "status", header: "Status", accessorFn: (row) => row.status?.phase ?? "—",
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => <KLStatus kind={info.getValue() === "Active" ? "ok" : "warn"}>{info.getValue()}</KLStatus>,
  },
  {
    id: "labels", header: "Labels",
    accessorFn: (row) => {
      const labels = row.metadata?.labels || {};
      const entries = Object.entries(labels).slice(0, 3).map(([k, v]) => `${k}=${v}`);
      return entries.join(", ") || "—";
    },
    meta: { mono: true, muted: true, w: "minmax(0, 2fr)" },
  },
  ageCol(),
];

// ─── Events ───────────────────────────────────────────────────────────────────

export const eventColumns = [
  {
    id: "type", header: "Type",
    accessorFn: (row) => row.type ?? "Normal",
    meta: { w: "0.7fr", sortable: true },
    cell: (info) => {
      const t = info.getValue();
      const isWarning = t === "Warning";
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: isWarning ? "var(--kl-warn)" : "var(--kl-text-faint)", flexShrink: 0 }} />
          <span style={{ color: isWarning ? "var(--kl-warn)" : "var(--kl-text)" }}>{t}</span>
        </span>
      );
    },
  },
  { id: "reason", header: "Reason", accessorFn: (row) => row.reason ?? "—", meta: { mono: true, w: "1fr", sortable: true } },
  {
    id: "object", header: "Object",
    accessorFn: (row) => `${row.regarding?.kind ?? row.involvedObject?.kind ?? ""}/${row.regarding?.name ?? row.involvedObject?.name ?? "—"}`,
    meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" },
  },
  { id: "namespace", header: "Namespace", accessorFn: (row) => row.regarding?.namespace ?? row.involvedObject?.namespace ?? row.metadata?.namespace ?? "—", meta: { mono: true, muted: true, w: "0.9fr", sortable: true } },
  { id: "message", header: "Message", accessorFn: (row) => row.note ?? row.message ?? "—", meta: { muted: true, w: "minmax(0, 3fr)", truncate: true } },
  {
    id: "count", header: "Count",
    accessorFn: (row) => row.deprecatedCount ?? row.count ?? 1,
    meta: { mono: true, align: "right", w: "0.5fr", sortable: true },
    cell: (info) => {
      const n = info.getValue();
      return <span style={{ color: n > 10 ? "var(--kl-warn)" : "var(--kl-text-muted)" }}>{n}</span>;
    },
  },
  {
    id: "age", header: "Age",
    accessorFn: (row) => row.deprecatedFirstTimestamp ?? row.firstTimestamp ?? row.metadata?.creationTimestamp,
    meta: { mono: true, muted: true, w: "0.5fr", sortable: true },
    cell: (info) => <TimestampCell ts={info.getValue()} />,
  },
];

import React from "react";
import { KLStatus } from "@/components/kl/Status";
import { ageCol } from "./_shared";

// ─── CRDs ─────────────────────────────────────────────────────────────────────

export const crdColumns = [
  {
    id: "name", header: "Name", accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2.5fr)", sortable: true },
    cell: (info) => <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span>,
  },
  { id: "group", header: "Group", accessorFn: (row) => row.spec?.group ?? "—", meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" } },
  { id: "kind", header: "Kind", accessorFn: (row) => row.spec?.names?.kind ?? "—", meta: { mono: true, w: "1fr" } },
  { id: "scope", header: "Scope", accessorFn: (row) => row.spec?.scope ?? "—", meta: { w: "0.8fr" }, cell: (info) => <KLStatus kind={info.getValue() === "Cluster" ? "info" : "ok"}>{info.getValue()}</KLStatus> },
  {
    id: "versions", header: "Versions",
    accessorFn: (row) => (row.spec?.versions || []).map((v) => v.name).join(", ") || "—",
    meta: { mono: true, muted: true, w: "1fr" },
  },
  {
    id: "established", header: "Established",
    accessorFn: (row) => {
      const cond = (row.status?.conditions || []).find((c) => c.type === "Established");
      return cond?.status === "True" ? "Yes" : "No";
    },
    meta: { w: "0.8fr" },
    cell: (info) => <KLStatus kind={info.getValue() === "Yes" ? "ok" : "warn"}>{info.getValue()}</KLStatus>,
  },
  ageCol(),
];

// ─── HorizontalPodAutoscalers ─────────────────────────────────────────────────

export const hpaColumns = [
  {
    id: "name", header: "Name", accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 1.8fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const current = row.status?.currentReplicas ?? 0;
      const desired = row.status?.desiredReplicas ?? 0;
      const min = row.spec?.minReplicas ?? 1;
      const max = row.spec?.maxReplicas ?? 1;
      const kind = current === desired && current >= min && current <= max ? "ok" : "warn";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <KLStatus kind={kind} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span>
        </div>
      );
    },
  },
  { id: "namespace", header: "Namespace", accessorFn: (row) => row.metadata?.namespace, meta: { mono: true, muted: true, w: "0.9fr", sortable: true } },
  {
    id: "target", header: "Target",
    accessorFn: (row) => `${row.spec?.scaleTargetRef?.kind}/${row.spec?.scaleTargetRef?.name}`,
    meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" },
  },
  {
    id: "replicas", header: "Replicas",
    accessorFn: (row) => `${row.status?.currentReplicas ?? 0} / ${row.spec?.minReplicas ?? 1}–${row.spec?.maxReplicas ?? 1}`,
    meta: { mono: true, w: "1fr" },
    cell: (info) => {
      const [cur, range] = info.getValue().split(" / ");
      return <span><b>{cur}</b> <span style={{ color: "var(--kl-text-muted)" }}>/ {range}</span></span>;
    },
  },
  {
    id: "utilization", header: "CPU Util",
    accessorFn: (row) => {
      const metrics = row.status?.currentMetrics || [];
      const cpu = metrics.find((m) => m.type === "Resource" && m.resource?.name === "cpu");
      return cpu?.resource?.current?.averageUtilization != null ? `${cpu.resource.current.averageUtilization}%` : "—";
    },
    meta: { mono: true, muted: true, w: "0.8fr" },
  },
  ageCol(),
];

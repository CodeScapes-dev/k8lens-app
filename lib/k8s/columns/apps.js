import React from "react";
import { KLStatus } from "@/components/kl/Status";
import { formatLabel } from "@/lib/k8s/utils";
import { ageCol, nameCol, nsCol } from "./_shared";

function ReadyMini({ ready }) {
  const parts = String(ready).split("/").map(Number);
  const r = parts[0] ?? 0;
  const t = parts[1] ?? 0;
  if (t === 0) return <span style={{ color: "var(--kl-text-muted)" }}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: r === 0 ? "var(--kl-err)" : r < t ? "var(--kl-warn)" : "var(--kl-text)", fontWeight: 600, fontFamily: "var(--kl-mono)" }}>
        {ready}
      </span>
      <div style={{ display: "flex", gap: 2 }}>
        {Array.from({ length: Math.min(t, 8) }).map((_, i) => (
          <div key={i} style={{
            width: 5, height: 8, borderRadius: 1,
            background: i < r ? "var(--kl-ok)" : "var(--kl-surface-2)",
            border: i < r ? "none" : "1px solid var(--kl-border)",
          }} />
        ))}
        {t > 8 && <span style={{ fontSize: 9, color: "var(--kl-text-faint)" }}>+{t - 8}</span>}
      </div>
    </div>
  );
}

// ─── Deployments ──────────────────────────────────────────────────────────────

function deploymentStatus(row) {
  const desired = row.spec?.replicas ?? 0;
  const ready = row.status?.readyReplicas ?? 0;
  const updated = row.status?.updatedReplicas ?? 0;
  if (desired === 0) return "ok";
  if (ready === desired && updated === desired) return "ok";
  if (ready === 0) return "err";
  return "warn";
}

function deploymentStatusLabel(row) {
  const kind = deploymentStatus(row);
  return kind === "ok" ? "Healthy" : kind === "warn" ? "Progressing" : "Degraded";
}

export const deploymentColumns = [
  {
    id: "name", header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 1.8fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const kind = deploymentStatus(row);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <KLStatus kind={kind} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
            {info.getValue()}
          </span>
        </div>
      );
    },
  },
  nsCol(),
  {
    id: "status", header: "Status",
    accessorFn: (row) => deploymentStatusLabel(row),
    meta: { w: "0.9fr", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const kind = deploymentStatus(row);
      return <KLStatus kind={kind}>{info.getValue()}</KLStatus>;
    },
  },
  {
    id: "replicas", header: "Replicas",
    accessorFn: (row) => `${row.status?.readyReplicas ?? 0}/${row.spec?.replicas ?? 0}`,
    meta: { w: "0.9fr" },
    cell: (info) => <ReadyMini ready={info.getValue()} />,
  },
  {
    id: "upToDate", header: "Up-to-date",
    accessorFn: (row) => row.status?.updatedReplicas ?? 0,
    meta: { mono: true, align: "right", w: "0.8fr", sortable: true },
  },
  {
    id: "available", header: "Available",
    accessorFn: (row) => row.status?.availableReplicas ?? 0,
    meta: { mono: true, align: "right", w: "0.7fr", sortable: true },
    cell: (info) => (
      <span style={{ color: info.getValue() === 0 ? "var(--kl-err)" : "var(--kl-text)" }}>{info.getValue()}</span>
    ),
  },
  {
    id: "strategy", header: "Strategy",
    accessorFn: (row) => formatLabel(row.spec?.strategy?.type ?? "—"),
    meta: { muted: true, w: "0.9fr" },
  },
  ageCol(),
];

// ─── StatefulSets ─────────────────────────────────────────────────────────────

export const statefulSetColumns = [
  {
    id: "name", header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const ready = row.status?.readyReplicas ?? 0;
      const desired = row.spec?.replicas ?? 0;
      const kind = desired === 0 ? "ok" : ready === desired ? "ok" : ready === 0 ? "err" : "warn";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <KLStatus kind={kind} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
            {info.getValue()}
          </span>
        </div>
      );
    },
  },
  nsCol(),
  {
    id: "replicas", header: "Replicas",
    accessorFn: (row) => `${row.status?.readyReplicas ?? 0}/${row.spec?.replicas ?? 0}`,
    meta: { w: "0.9fr" },
    cell: (info) => <ReadyMini ready={info.getValue()} />,
  },
  {
    id: "serviceName", header: "Service",
    accessorFn: (row) => row.spec?.serviceName ?? "—",
    meta: { mono: true, muted: true, w: "1fr" },
  },
  {
    id: "updateStrategy", header: "Update Strategy",
    accessorFn: (row) => formatLabel(row.spec?.updateStrategy?.type ?? "—"),
    meta: { muted: true, w: "1fr" },
  },
  ageCol(),
];

// ─── DaemonSets ───────────────────────────────────────────────────────────────

function daemonSetStatus(row) {
  const desired = row.status?.desiredNumberScheduled ?? 0;
  const ready = row.status?.numberReady ?? 0;
  if (desired === 0 || ready === desired) return "ok";
  if (ready === 0) return "err";
  return "warn";
}

function daemonSetStatusLabel(row) {
  const kind = daemonSetStatus(row);
  return kind === "ok" ? "Healthy" : kind === "err" ? "Degraded" : "Progressing";
}

export const daemonSetColumns = [
  {
    id: "name", header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 1.8fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const kind = daemonSetStatus(row);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <KLStatus kind={kind} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
            {info.getValue()}
          </span>
        </div>
      );
    },
  },
  nsCol(),
  {
    id: "status", header: "Status",
    accessorFn: (row) => daemonSetStatusLabel(row),
    meta: { w: "0.9fr", sortable: true },
    cell: (info) => {
      const kind = daemonSetStatus(info.row.original);
      return <KLStatus kind={kind}>{info.getValue()}</KLStatus>;
    },
  },
  {
    id: "replicas", header: "Replicas",
    accessorFn: (row) => `${row.status?.numberReady ?? 0}/${row.status?.desiredNumberScheduled ?? 0}`,
    meta: { w: "0.9fr" },
    cell: (info) => <ReadyMini ready={info.getValue()} />,
  },
  {
    id: "upToDate", header: "Up-to-date",
    accessorFn: (row) => row.status?.updatedNumberScheduled ?? 0,
    meta: { mono: true, align: "right", w: "0.8fr", sortable: true },
  },
  {
    id: "available", header: "Available",
    accessorFn: (row) => row.status?.numberAvailable ?? 0,
    meta: { mono: true, align: "right", w: "0.7fr", sortable: true },
    cell: (info) => (
      <span style={{ color: info.getValue() === 0 ? "var(--kl-err)" : "var(--kl-text)" }}>{info.getValue()}</span>
    ),
  },
  ageCol(),
];

// ─── ReplicaSets ──────────────────────────────────────────────────────────────

export const replicaSetColumns = [
  {
    id: "name", header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const desired = row.spec?.replicas ?? 0;
      const ready = row.status?.readyReplicas ?? 0;
      const kind = desired === 0 ? "muted" : ready === desired ? "ok" : ready === 0 ? "err" : "warn";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <KLStatus kind={kind} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
            {info.getValue()}
          </span>
        </div>
      );
    },
  },
  nsCol(),
  {
    id: "replicas", header: "Replicas",
    accessorFn: (row) => `${row.status?.readyReplicas ?? 0}/${row.spec?.replicas ?? 0}`,
    meta: { w: "0.9fr" },
    cell: (info) => <ReadyMini ready={info.getValue()} />,
  },
  {
    id: "owner", header: "Owner",
    accessorFn: (row) => {
      const ref = (row.metadata?.ownerReferences || [])[0];
      return ref ? `${ref.kind}/${ref.name}` : "—";
    },
    meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" },
  },
  ageCol(),
];

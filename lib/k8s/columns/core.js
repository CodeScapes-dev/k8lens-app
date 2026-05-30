import React from "react";
import { getPodStatus, getPodRestarts } from "@/lib/k8s/utils";
import { KLStatus } from "@/components/kl/Status";
import { ageCol, nameCol, nsCol } from "./_shared";

// ─── helpers ─────────────────────────────────────────────────────────────────

function col(id, header, accessorFn, meta = {}) {
  return { id, header, accessorFn, meta };
}

// ─── Pods ─────────────────────────────────────────────────────────────────────

function podStatusKind(status) {
  if (!status) return "muted";
  const s = status.toLowerCase();
  if (s === "running" || s === "completed" || s === "succeeded") return "ok";
  if (s === "pending" || s === "containercreating" || s === "init") return "warn";
  return "err";
}

export const podColumns = [
  {
    id: "name",
    header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2.4fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const status = getPodStatus(row);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <KLStatus kind={podStatusKind(status)} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
            {info.getValue()}
          </span>
        </div>
      );
    },
  },
  col("namespace", "Namespace", (row) => row.metadata?.namespace, { mono: true, muted: true, w: "0.9fr", sortable: true }),
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => getPodStatus(row),
    meta: { w: "1.1fr", sortable: true },
    cell: (info) => {
      const s = info.getValue();
      return <KLStatus kind={podStatusKind(s)}>{s}</KLStatus>;
    },
  },
  {
    id: "ready",
    header: "Ready",
    accessorFn: (row) => {
      const cs = row.status?.containerStatuses || [];
      const ready = cs.filter((c) => c.ready).length;
      const total = cs.length || (row.spec?.containers?.length ?? 0);
      return `${ready}/${total}`;
    },
    meta: { mono: true, align: "right", w: "0.5fr" },
    cell: (info) => {
      const val = info.getValue();
      const notReady = val.startsWith("0/");
      return <span style={{ color: notReady ? "var(--kl-err)" : "var(--kl-text)" }}>{val}</span>;
    },
  },
  {
    id: "restarts",
    header: "Restarts",
    accessorFn: (row) => getPodRestarts(row),
    meta: { mono: true, align: "right", w: "0.7fr", sortable: true },
    cell: (info) => {
      const n = info.getValue();
      const color = n === 0 ? "var(--kl-text-muted)" : n > 5 ? "var(--kl-err)" : "var(--kl-warn)";
      return <span style={{ color, fontWeight: n > 0 ? 600 : 400 }}>{n}</span>;
    },
  },
  col("node", "Node", (row) => row.spec?.nodeName ?? "—", { mono: true, muted: true, w: "1.2fr", sortable: true }),
  ageCol(),
];

// ─── Services ─────────────────────────────────────────────────────────────────

export const serviceColumns = [
  nameCol(),
  nsCol(),
  col("type", "Type", (row) => row.spec?.type ?? "—", { w: "0.8fr", sortable: true }),
  col("clusterIP", "Cluster IP", (row) => row.spec?.clusterIP ?? "—", { mono: true, muted: true, w: "1fr" }),
  {
    id: "ports",
    header: "Ports",
    accessorFn: (row) => (row.spec?.ports || []).map((p) => `${p.port}/${p.protocol}`).join(", ") || "—",
    meta: { mono: true, muted: true, w: "1fr" },
  },
  ageCol(),
];

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const endpointsColumns = [
  nameCol(),
  nsCol(),
  {
    id: "addresses",
    header: "Addresses",
    accessorFn: (row) => {
      const subsets = row.subsets || [];
      return subsets.flatMap((s) => (s.addresses || []).map((a) => a.ip)).join(", ") || "—";
    },
    meta: { mono: true, muted: true, w: "minmax(0, 2fr)" },
  },
  ageCol(),
];

// ─── ConfigMaps ───────────────────────────────────────────────────────────────

export const configMapColumns = [
  nameCol(),
  nsCol(),
  {
    id: "keys",
    header: "Keys",
    accessorFn: (row) => Object.keys(row.data || {}).length,
    meta: { mono: true, muted: true, w: "0.6fr" },
  },
  ageCol(),
];

// ─── Secrets ──────────────────────────────────────────────────────────────────

export const secretColumns = [
  nameCol(),
  nsCol(),
  col("type", "Type", (row) => row.type ?? "—", { muted: true, w: "1.2fr" }),
  {
    id: "keys",
    header: "Keys",
    accessorFn: (row) => Object.keys(row.data || {}).length,
    meta: { mono: true, muted: true, w: "0.6fr" },
  },
  ageCol(),
];

// ─── Nodes ────────────────────────────────────────────────────────────────────

function nodeStatusKind(node) {
  const ready = (node.status?.conditions || []).find((c) => c.type === "Ready");
  return ready?.status === "True" ? "ok" : "err";
}

export const nodeColumns = [
  {
    id: "name",
    header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <KLStatus kind={nodeStatusKind(row)} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span>
        </div>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => {
      const ready = (row.status?.conditions || []).find((c) => c.type === "Ready");
      return ready?.status === "True" ? "Ready" : "NotReady";
    },
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => <KLStatus kind={info.getValue() === "Ready" ? "ok" : "err"}>{info.getValue()}</KLStatus>,
  },
  col("version", "Version", (row) => row.status?.nodeInfo?.kubeletVersion ?? "—", { mono: true, muted: true, w: "0.9fr" }),
  col("os", "OS", (row) => row.status?.nodeInfo?.osImage ?? "—", { muted: true, w: "1.2fr" }),
  col("arch", "Arch", (row) => row.status?.nodeInfo?.architecture ?? "—", { mono: true, muted: true, w: "0.6fr" }),
  ageCol(),
];

// ─── Namespaces ───────────────────────────────────────────────────────────────

export const namespaceColumns = [
  nameCol("minmax(0, 2fr)"),
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => row.status?.phase ?? "—",
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => <KLStatus kind={info.getValue() === "Active" ? "ok" : "warn"}>{info.getValue()}</KLStatus>,
  },
  ageCol(),
];

// ─── PersistentVolumes ────────────────────────────────────────────────────────

export const pvColumns = [
  nameCol(),
  col("capacity", "Capacity", (row) => row.spec?.capacity?.storage ?? "—", { mono: true, w: "0.8fr" }),
  col("accessModes", "Access Modes", (row) => (row.spec?.accessModes || []).join(", ") || "—", { mono: true, muted: true, w: "1.2fr" }),
  col("reclaimPolicy", "Reclaim Policy", (row) => row.spec?.persistentVolumeReclaimPolicy ?? "—", { w: "1fr" }),
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => row.status?.phase ?? "—",
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => {
      const s = info.getValue();
      const kind = s === "Bound" ? "ok" : s === "Available" ? "info" : s === "Released" ? "warn" : "err";
      return <KLStatus kind={kind}>{s}</KLStatus>;
    },
  },
  col("storageClass", "Storage Class", (row) => row.spec?.storageClassName ?? "—", { muted: true, w: "1fr" }),
  ageCol(),
];

// ─── PersistentVolumeClaims ───────────────────────────────────────────────────

export const pvcColumns = [
  nameCol(),
  nsCol(),
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => row.status?.phase ?? "—",
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => {
      const s = info.getValue();
      return <KLStatus kind={s === "Bound" ? "ok" : s === "Pending" ? "warn" : "err"}>{s}</KLStatus>;
    },
  },
  col("capacity", "Capacity", (row) => row.status?.capacity?.storage ?? "—", { mono: true, w: "0.8fr" }),
  col("accessModes", "Access Modes", (row) => (row.spec?.accessModes || []).join(", ") || "—", { mono: true, muted: true, w: "1fr" }),
  col("storageClass", "Storage Class", (row) => row.spec?.storageClassName ?? "—", { muted: true, w: "1fr" }),
  ageCol(),
];

// ─── ServiceAccounts ──────────────────────────────────────────────────────────

export const serviceAccountColumns = [
  nameCol(),
  nsCol(),
  {
    id: "secrets",
    header: "Secrets",
    accessorFn: (row) => (row.secrets || []).length,
    meta: { mono: true, muted: true, w: "0.6fr" },
  },
  ageCol(),
];

// ─── ResourceQuotas ───────────────────────────────────────────────────────────

export const resourceQuotaColumns = [
  nameCol(),
  nsCol(),
  {
    id: "hard",
    header: "Hard Limits",
    accessorFn: (row) => Object.keys(row.spec?.hard || {}).join(", ") || "—",
    meta: { muted: true, w: "minmax(0, 2fr)" },
  },
  ageCol(),
];

// ─── LimitRanges ──────────────────────────────────────────────────────────────

export const limitRangeColumns = [
  nameCol(),
  nsCol(),
  {
    id: "types",
    header: "Types",
    accessorFn: (row) => [...new Set((row.spec?.limits || []).map((l) => l.type))].join(", ") || "—",
    meta: { muted: true, w: "1fr" },
  },
  ageCol(),
];

// ─── ReplicationControllers ───────────────────────────────────────────────────

export const replicationControllerColumns = [
  nameCol(),
  nsCol(),
  col("desired", "Desired", (row) => row.spec?.replicas ?? 0, { mono: true, align: "right", w: "0.6fr" }),
  col("ready", "Ready", (row) => row.status?.readyReplicas ?? 0, { mono: true, align: "right", w: "0.6fr" }),
  ageCol(),
];

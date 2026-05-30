import React from "react";
import { KLStatus } from "@/components/kl/Status";
import { ageCol, nameCol, nsCol } from "./_shared";

// ─── PersistentVolumes ────────────────────────────────────────────────────────

export const pvColumns = [
  {
    id: "name", header: "Name", accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2fr)", sortable: true },
    cell: (info) => {
      const s = info.row.original.status?.phase;
      const kind = s === "Bound" ? "ok" : s === "Available" ? "info" : s === "Released" ? "warn" : "err";
      return <div style={{ display: "flex", alignItems: "center", gap: 8 }}><KLStatus kind={kind} dotOnly /><span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span></div>;
    },
  },
  { id: "capacity", header: "Capacity", accessorFn: (row) => row.spec?.capacity?.storage ?? "—", meta: { mono: true, w: "0.8fr" } },
  { id: "accessModes", header: "Access Modes", accessorFn: (row) => (row.spec?.accessModes || []).map((m) => m.replace("ReadWrite", "RW").replace("ReadOnly", "RO").replace("Many", "Many").replace("Once", "Once")).join(", ") || "—", meta: { mono: true, muted: true, w: "1fr" } },
  { id: "reclaimPolicy", header: "Reclaim", accessorFn: (row) => row.spec?.persistentVolumeReclaimPolicy ?? "—", meta: { w: "0.7fr" } },
  {
    id: "status", header: "Status", accessorFn: (row) => row.status?.phase ?? "—",
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => { const s = info.getValue(); return <KLStatus kind={s === "Bound" ? "ok" : s === "Available" ? "info" : s === "Released" ? "warn" : "err"}>{s}</KLStatus>; },
  },
  { id: "claim", header: "Claim", accessorFn: (row) => { const ref = row.spec?.claimRef; return ref ? `${ref.namespace}/${ref.name}` : "—"; }, meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" } },
  { id: "storageClass", header: "Storage Class", accessorFn: (row) => row.spec?.storageClassName ?? "—", meta: { muted: true, w: "1fr" } },
  ageCol(),
];

// ─── PersistentVolumeClaims ───────────────────────────────────────────────────

export const pvcColumns = [
  {
    id: "name", header: "Name", accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 1.8fr)", sortable: true },
    cell: (info) => {
      const s = info.row.original.status?.phase;
      const kind = s === "Bound" ? "ok" : s === "Pending" ? "warn" : "err";
      return <div style={{ display: "flex", alignItems: "center", gap: 8 }}><KLStatus kind={kind} dotOnly /><span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span></div>;
    },
  },
  nsCol(),
  {
    id: "status", header: "Status", accessorFn: (row) => row.status?.phase ?? "—",
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => { const s = info.getValue(); return <KLStatus kind={s === "Bound" ? "ok" : s === "Pending" ? "warn" : "err"}>{s}</KLStatus>; },
  },
  { id: "capacity", header: "Capacity", accessorFn: (row) => row.status?.capacity?.storage ?? row.spec?.resources?.requests?.storage ?? "—", meta: { mono: true, w: "0.8fr" } },
  { id: "accessModes", header: "Access Modes", accessorFn: (row) => (row.spec?.accessModes || []).map((m) => m.replace("ReadWrite", "RW").replace("ReadOnly", "RO")).join(", ") || "—", meta: { mono: true, muted: true, w: "0.9fr" } },
  { id: "storageClass", header: "Storage Class", accessorFn: (row) => row.spec?.storageClassName ?? "—", meta: { muted: true, w: "1fr" } },
  { id: "volume", header: "Volume", accessorFn: (row) => row.spec?.volumeName ?? "—", meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" } },
  ageCol(),
];

// ─── StorageClasses ───────────────────────────────────────────────────────────

export const storageClassColumns = [
  nameCol("minmax(0, 2fr)"),
  { id: "provisioner", header: "Provisioner", accessorFn: (row) => row.provisioner ?? "—", meta: { mono: true, muted: true, w: "minmax(0, 2fr)" } },
  { id: "reclaimPolicy", header: "Reclaim", accessorFn: (row) => row.reclaimPolicy ?? "—", meta: { w: "0.7fr" } },
  { id: "volumeBindingMode", header: "Binding Mode", accessorFn: (row) => row.volumeBindingMode ?? "—", meta: { muted: true, w: "1.2fr" } },
  {
    id: "allowExpansion", header: "Expandable",
    accessorFn: (row) => row.allowVolumeExpansion ? "Yes" : "No",
    meta: { w: "0.8fr" },
    cell: (info) => <KLStatus kind={info.getValue() === "Yes" ? "ok" : "muted"}>{info.getValue()}</KLStatus>,
  },
  {
    id: "default", header: "Default",
    accessorFn: (row) => row.metadata?.annotations?.["storageclass.kubernetes.io/is-default-class"] === "true" ? "Yes" : "No",
    meta: { w: "0.7fr" },
    cell: (info) => <KLStatus kind={info.getValue() === "Yes" ? "info" : "muted"}>{info.getValue()}</KLStatus>,
  },
  ageCol(),
];

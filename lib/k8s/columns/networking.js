import React from "react";
import { KLStatus } from "@/components/kl/Status";
import { ageCol, nameCol, nsCol } from "./_shared";

// ─── Services ─────────────────────────────────────────────────────────────────

export const serviceColumns = [
  nameCol(),
  nsCol(),
  {
    id: "type",
    header: "Type",
    accessorFn: (row) => row.spec?.type ?? "ClusterIP",
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => {
      const t = info.getValue();
      const kind = t === "LoadBalancer" ? "info" : t === "NodePort" ? "warn" : "muted";
      return <KLStatus kind={kind}>{t}</KLStatus>;
    },
  },
  {
    id: "clusterIP",
    header: "Cluster IP",
    accessorFn: (row) => row.spec?.clusterIP ?? "—",
    meta: { mono: true, muted: true, w: "1fr" },
  },
  {
    id: "externalIP",
    header: "External IP",
    accessorFn: (row) => {
      const ips = row.status?.loadBalancer?.ingress?.map((i) => i.ip || i.hostname) ?? [];
      return ips.join(", ") || "—";
    },
    meta: { mono: true, muted: true, w: "1fr" },
  },
  {
    id: "ports",
    header: "Ports",
    accessorFn: (row) =>
      (row.spec?.ports || []).map((p) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ""}/${p.protocol}`).join(", ") || "—",
    meta: { mono: true, muted: true, w: "1fr" },
  },
  ageCol(),
];

// ─── Ingresses ────────────────────────────────────────────────────────────────

export const ingressColumns = [
  nameCol(),
  nsCol(),
  {
    id: "ingressClass",
    header: "Class",
    accessorFn: (row) =>
      row.spec?.ingressClassName ?? row.metadata?.annotations?.["kubernetes.io/ingress.class"] ?? "—",
    meta: { mono: true, muted: true, w: "0.8fr" },
  },
  {
    id: "hosts",
    header: "Hosts",
    accessorFn: (row) =>
      (row.spec?.rules || []).map((r) => r.host || "*").join(", ") || "—",
    meta: { mono: true, w: "minmax(0, 1.5fr)" },
  },
  {
    id: "address",
    header: "Address",
    accessorFn: (row) => {
      const ips = row.status?.loadBalancer?.ingress?.map((i) => i.ip || i.hostname) ?? [];
      return ips.join(", ") || "—";
    },
    meta: { mono: true, muted: true, w: "1fr" },
  },
  ageCol(),
];

// ─── IngressClasses ───────────────────────────────────────────────────────────

export const ingressClassColumns = [
  nameCol("minmax(0, 2fr)"),
  {
    id: "controller",
    header: "Controller",
    accessorFn: (row) => row.spec?.controller ?? "—",
    meta: { mono: true, muted: true, w: "minmax(0, 2fr)" },
  },
  {
    id: "default",
    header: "Default",
    accessorFn: (row) =>
      row.metadata?.annotations?.["ingressclass.kubernetes.io/is-default-class"] === "true" ? "Yes" : "No",
    meta: { w: "0.6fr" },
    cell: (info) => (
      <KLStatus kind={info.getValue() === "Yes" ? "ok" : "muted"}>{info.getValue()}</KLStatus>
    ),
  },
  ageCol(),
];

// ─── NetworkPolicies ──────────────────────────────────────────────────────────

export const networkPolicyColumns = [
  nameCol(),
  nsCol(),
  {
    id: "podSelector",
    header: "Pod Selector",
    accessorFn: (row) => {
      const sel = row.spec?.podSelector?.matchLabels;
      if (!sel || Object.keys(sel).length === 0) return "All pods";
      return Object.entries(sel).map(([k, v]) => `${k}=${v}`).join(", ");
    },
    meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" },
  },
  {
    id: "policyTypes",
    header: "Policy Types",
    accessorFn: (row) => (row.spec?.policyTypes || []).join(", ") || "—",
    meta: { w: "1fr" },
  },
  ageCol(),
];

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const endpointsColumns = [
  nameCol(),
  nsCol(),
  {
    id: "endpoints",
    header: "Endpoints",
    accessorFn: (row) => {
      const subsets = row.subsets || [];
      const ips = subsets.flatMap((s) => (s.addresses || []).map((a) => a.ip));
      const ports = subsets.flatMap((s) => (s.ports || []).map((p) => p.port));
      if (ips.length === 0) return "—";
      const portStr = ports.length > 0 ? `:${ports[0]}` : "";
      return ips.length <= 2 ? ips.map((ip) => `${ip}${portStr}`).join(", ") : `${ips[0]}${portStr} +${ips.length - 1} more`;
    },
    meta: { mono: true, muted: true, w: "minmax(0, 2fr)" },
  },
  {
    id: "ready",
    header: "Ready",
    accessorFn: (row) => {
      const subsets = row.subsets || [];
      return subsets.reduce((n, s) => n + (s.addresses?.length ?? 0), 0);
    },
    meta: { mono: true, align: "right", w: "0.6fr" },
    cell: (info) => (
      <span style={{ color: info.getValue() === 0 ? "var(--kl-err)" : "var(--kl-ok)" }}>{info.getValue()}</span>
    ),
  },
  ageCol(),
];

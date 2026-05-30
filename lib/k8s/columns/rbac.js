import React from "react";
import { KLStatus } from "@/components/kl/Status";
import { ageCol, nameCol, nsCol } from "./_shared";

// ─── Roles ────────────────────────────────────────────────────────────────────

export const roleColumns = [
  nameCol(),
  nsCol(),
  {
    id: "rules", header: "Rules",
    accessorFn: (row) => (row.rules || []).length,
    meta: { mono: true, align: "right", w: "0.6fr" },
    cell: (info) => <span style={{ color: "var(--kl-text-muted)" }}>{info.getValue()}</span>,
  },
  {
    id: "verbs", header: "Verbs",
    accessorFn: (row) => {
      const verbs = [...new Set((row.rules || []).flatMap((r) => r.verbs || []))];
      return verbs.slice(0, 5).join(", ") + (verbs.length > 5 ? " …" : "");
    },
    meta: { mono: true, muted: true, w: "minmax(0, 2fr)" },
  },
  ageCol(),
];

// ─── RoleBindings ─────────────────────────────────────────────────────────────

export const roleBindingColumns = [
  nameCol(),
  nsCol(),
  {
    id: "role", header: "Role",
    accessorFn: (row) => `${row.roleRef?.kind}/${row.roleRef?.name}`,
    meta: { mono: true, w: "minmax(0, 1.5fr)" },
    cell: (info) => <span style={{ fontFamily: "var(--kl-mono)", color: "var(--kl-accent)" }}>{info.getValue()}</span>,
  },
  {
    id: "subjects", header: "Subjects",
    accessorFn: (row) => {
      const s = row.subjects || [];
      if (s.length === 0) return "—";
      const first = `${s[0].kind}/${s[0].name}`;
      return s.length === 1 ? first : `${first} +${s.length - 1}`;
    },
    meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" },
  },
  ageCol(),
];

// ─── ClusterRoles ─────────────────────────────────────────────────────────────

export const clusterRoleColumns = [
  nameCol("minmax(0, 2fr)"),
  {
    id: "rules", header: "Rules",
    accessorFn: (row) => (row.rules || []).length,
    meta: { mono: true, align: "right", w: "0.6fr" },
    cell: (info) => <span style={{ color: "var(--kl-text-muted)" }}>{info.getValue()}</span>,
  },
  {
    id: "aggregation", header: "Aggregation",
    accessorFn: (row) => row.aggregationRule ? "Yes" : "No",
    meta: { w: "0.8fr" },
    cell: (info) => <KLStatus kind={info.getValue() === "Yes" ? "info" : "muted"}>{info.getValue()}</KLStatus>,
  },
  {
    id: "verbs", header: "Verbs",
    accessorFn: (row) => {
      const verbs = [...new Set((row.rules || []).flatMap((r) => r.verbs || []))];
      return verbs.slice(0, 6).join(", ") + (verbs.length > 6 ? " …" : "");
    },
    meta: { mono: true, muted: true, w: "minmax(0, 2fr)" },
  },
  ageCol(),
];

// ─── ClusterRoleBindings ──────────────────────────────────────────────────────

export const clusterRoleBindingColumns = [
  nameCol("minmax(0, 1.8fr)"),
  {
    id: "role", header: "Role",
    accessorFn: (row) => `${row.roleRef?.kind}/${row.roleRef?.name}`,
    meta: { mono: true, w: "minmax(0, 1.5fr)" },
    cell: (info) => <span style={{ fontFamily: "var(--kl-mono)", color: "var(--kl-accent)" }}>{info.getValue()}</span>,
  },
  {
    id: "subjects", header: "Subjects",
    accessorFn: (row) => {
      const s = row.subjects || [];
      if (s.length === 0) return "—";
      const first = `${s[0].kind}/${s[0].name}`;
      return s.length === 1 ? first : `${first} +${s.length - 1}`;
    },
    meta: { mono: true, muted: true, w: "minmax(0, 1.5fr)" },
  },
  ageCol(),
];

// ─── ServiceAccounts ──────────────────────────────────────────────────────────

export const serviceAccountColumns = [
  nameCol(),
  nsCol(),
  {
    id: "secrets", header: "Secrets",
    accessorFn: (row) => (row.secrets || []).length,
    meta: { mono: true, align: "right", w: "0.6fr" },
    cell: (info) => <span style={{ color: "var(--kl-text-muted)" }}>{info.getValue()}</span>,
  },
  {
    id: "imagePullSecrets", header: "Image Pull Secrets",
    accessorFn: (row) => (row.imagePullSecrets || []).length,
    meta: { mono: true, align: "right", w: "1fr" },
    cell: (info) => <span style={{ color: "var(--kl-text-muted)" }}>{info.getValue()}</span>,
  },
  ageCol(),
];

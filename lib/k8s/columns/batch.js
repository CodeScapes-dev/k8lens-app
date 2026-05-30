import React from "react";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";
import { ageCol, nsCol } from "./_shared";

// ─── Jobs ─────────────────────────────────────────────────────────────────────

function jobStatus(row) {
  const conditions = row.status?.conditions || [];
  const complete = conditions.find((c) => c.type === "Complete" && c.status === "True");
  const failed = conditions.find((c) => c.type === "Failed" && c.status === "True");
  if (complete) return { kind: "ok", label: "Complete" };
  if (failed) return { kind: "err", label: "Failed" };
  return { kind: "warn", label: "Running" };
}

function jobDuration(row) {
  const start = row.status?.startTime;
  const end = row.status?.completionTime;
  if (!start) return "—";
  const ms = new Date(end || Date.now()) - new Date(start);
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export const jobColumns = [
  {
    id: "name", header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 2fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const { kind } = jobStatus(row);
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
    accessorFn: (row) => jobStatus(row).label,
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const { kind, label } = jobStatus(row);
      return <KLStatus kind={kind}>{label}</KLStatus>;
    },
  },
  {
    id: "completions", header: "Completions",
    accessorFn: (row) => {
      const succeeded = row.status?.succeeded ?? 0;
      const desired = row.spec?.completions ?? 1;
      return `${succeeded}/${desired}`;
    },
    meta: { mono: true, align: "right", w: "0.8fr" },
    cell: (info) => {
      const [done, total] = info.getValue().split("/").map(Number);
      return <span style={{ color: done === total ? "var(--kl-ok)" : "var(--kl-text)" }}>{info.getValue()}</span>;
    },
  },
  {
    id: "duration", header: "Duration",
    accessorFn: (row) => jobDuration(row),
    meta: { mono: true, muted: true, w: "0.7fr" },
  },
  ageCol(),
];

// ─── CronJobs ─────────────────────────────────────────────────────────────────

export const cronJobColumns = [
  {
    id: "name", header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w: "minmax(0, 1.8fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      const suspended = row.spec?.suspend;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <KLStatus kind={suspended ? "muted" : "ok"} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
            {info.getValue()}
          </span>
        </div>
      );
    },
  },
  nsCol(),
  {
    id: "schedule", header: "Schedule",
    accessorFn: (row) => row.spec?.schedule ?? "—",
    meta: { mono: true, w: "1fr" },
  },
  {
    id: "suspended", header: "Suspended",
    accessorFn: (row) => row.spec?.suspend ? "Yes" : "No",
    meta: { w: "0.7fr" },
    cell: (info) => (
      <KLStatus kind={info.getValue() === "Yes" ? "warn" : "ok"}>{info.getValue()}</KLStatus>
    ),
  },
  {
    id: "active", header: "Active",
    accessorFn: (row) => (row.status?.active || []).length,
    meta: { mono: true, align: "right", w: "0.6fr" },
  },
  {
    id: "lastRun", header: "Last Run",
    accessorFn: (row) => {
      const t = row.status?.lastScheduleTime;
      return t ? calculateAge(t) + " ago" : "Never";
    },
    meta: { mono: true, muted: true, w: "0.8fr" },
  },
  ageCol(),
];

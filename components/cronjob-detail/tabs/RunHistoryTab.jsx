"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { KLBadge } from "@/components/kl/Badge";
import { Panel } from "@/components/kl/Panel";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

function jobDuration(job) {
  const start = job?.status?.startTime;
  const end = job?.status?.completionTime;
  if (!start) return null;
  const endMs = end ? new Date(end).getTime() : Date.now();
  return Math.round((endMs - new Date(start).getTime()) / 1000);
}

function jobStatus(job) {
  const conditions = job?.status?.conditions ?? [];
  if (conditions.some((c) => c.type === "Complete" && c.status === "True")) return "Succeeded";
  if (conditions.some((c) => c.type === "Failed" && c.status === "True")) return "Failed";
  if (job?.status?.active > 0) return "Running";
  return "Unknown";
}

function statusColor(s) {
  if (s === "Succeeded") return "var(--kl-ok)";
  if (s === "Failed") return "var(--kl-err)";
  if (s === "Running") return "var(--kl-warn)";
  return "var(--kl-text-muted)";
}

function formatDuration(secs) {
  if (secs == null) return "—";
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "var(--kl-surface)", border: "1px solid var(--kl-border)", borderRadius: 8, padding: "10px 14px", fontSize: 11.5 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: statusColor(d.status) }}>{d.status}</div>
      <div style={{ color: "var(--kl-text-muted)" }}>Started: {d.startTime ? new Date(d.startTime).toLocaleString() : "—"}</div>
      <div style={{ color: "var(--kl-text-muted)" }}>Duration: {formatDuration(d.duration)}</div>
      {d.podName && <div style={{ color: "var(--kl-text-muted)" }}>Pod: {d.podName}</div>}
    </div>
  );
}

export function RunHistoryTab({ jobs = [] }) {
  const router = useRouter();

  const sorted = [...jobs].sort((a, b) =>
    new Date(b?.status?.startTime ?? 0) - new Date(a?.status?.startTime ?? 0),
  );

  if (sorted.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13 }}>
        No completed runs found. Runs will appear here after the CronJob has executed at least once.
      </div>
    );
  }

  const chartData = [...sorted].reverse().map((job) => {
    const status = jobStatus(job);
    const duration = jobDuration(job);
    const podName = (job?.status?.jobPods?.[0] ?? job?.metadata?.name);
    return {
      name: new Date(job?.status?.startTime ?? 0).toLocaleDateString(),
      duration: duration ?? 0,
      status,
      startTime: job?.status?.startTime,
      podName,
    };
  });

  const succeeded = sorted.filter((j) => jobStatus(j) === "Succeeded");
  const successRate = sorted.length ? Math.round((succeeded.length / sorted.length) * 100) : 0;
  const avgDuration = succeeded.length
    ? Math.round(succeeded.reduce((s, j) => s + (jobDuration(j) ?? 0), 0) / succeeded.length)
    : null;
  const lastRun = sorted[0]?.status?.startTime;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats */}
      <div style={{ display: "flex", border: "1px solid var(--kl-border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { label: "Total Runs", value: sorted.length },
          { label: "Success Rate", value: `${successRate}%` },
          { label: "Avg Duration", value: formatDuration(avgDuration) },
          { label: "Last Run", value: lastRun ? new Date(lastRun).toLocaleDateString() : "—" },
        ].map(({ label, value }, i) => (
          <div key={i} style={{ flex: 1, padding: "12px 0", textAlign: "center", borderRight: i < 3 ? "1px solid var(--kl-border)" : "none" }}>
            <div style={{ fontSize: 10.5, color: "var(--kl-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
            <div className="kl-mono" style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: "var(--kl-surface)", border: "1px solid var(--kl-border)", borderRadius: 10, padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--kl-text)" }}>Run Timeline</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--kl-text-muted)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--kl-text-muted)" }} unit="s" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="duration" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={statusColor(entry.status)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <Panel style={{ overflow: "hidden" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Started</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[100px]">Duration</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[110px]">Status</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Pod</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[60px]">Logs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((job, i) => {
              const status = jobStatus(job);
              const duration = jobDuration(job);
              const podName = job?.metadata?.name;
              const ns = job?.metadata?.namespace;
              const tone = status === "Succeeded" ? "ok" : status === "Failed" ? "err" : "warn";
              return (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{job?.status?.startTime ? new Date(job.status.startTime).toLocaleString() : "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{formatDuration(duration)}</TableCell>
                  <TableCell><KLBadge tone={tone}>{status}</KLBadge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{podName}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => router.push(`/workloads/pods/${ns}/${podName}`)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--kl-accent)", fontSize: 12, padding: 0 }}
                    >
                      Logs →
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

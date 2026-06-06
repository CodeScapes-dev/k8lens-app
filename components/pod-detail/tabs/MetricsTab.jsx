"use client";

import React from "react";
import {
  RadialBarChart, RadialBar, PolarRadiusAxis, Label,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Panel } from "@/components/kl/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricValue } from "@/components/kl/MetricValue";
import { useMetrics } from "@/hooks/use-metrics";
import {
  fmtCores, fmtMilliStr, fmtGB, fmtMB, pctColor,
} from "@/lib/k8s/metrics-utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function parseCpuToMilli(s) {
  if (!s) return 0;
  if (s.endsWith("m")) return parseInt(s, 10);
  return Math.round(parseFloat(s) * 1000);
}

function parseMemToBytes(s) {
  if (!s) return 0;
  const units = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 };
  for (const [sfx, mult] of Object.entries(units)) {
    if (s.endsWith(sfx)) return Math.round(parseFloat(s) * mult);
  }
  return parseInt(s, 10);
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, hover, sub }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-base font-mono font-semibold leading-tight">
        <MetricValue display={value} hover={hover} />
      </span>
      {sub && <span className="text-[11px] text-muted-foreground font-mono">{sub}</span>}
    </div>
  );
}

// ── Gauge ──────────────────────────────────────────────────────────────────

function Gauge({ label, pct, primary, hover, color = "hsl(210 100% 50%)" }) {
  const filled = Math.min(100, Math.max(0, pct ?? 0));
  const barColor = pctColor(filled, color);
  const chartData = [{ used: filled, remaining: 100 - filled }];
  const chartConfig = {
    used:      { label: "Used",      color: barColor },
    remaining: { label: "Remaining", color: "hsl(var(--muted))" },
  };
  return (
    <div className="flex flex-col items-center" style={{ width: 180 }}>
      <div style={{ height: 90, overflow: "hidden" }}>
        <ChartContainer config={chartConfig} className="w-full" style={{ height: 160 }}>
          <RadialBarChart data={chartData} endAngle={180} innerRadius={55} outerRadius={80}>
            <RadialBar dataKey="remaining" stackId="a" cornerRadius={5} fill="var(--color-remaining)" className="stroke-transparent stroke-2" />
            <RadialBar dataKey="used"      stackId="a" cornerRadius={5} fill="var(--color-used)"      className="stroke-transparent stroke-2" />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                  const { cx, cy } = viewBox;
                  return (
                    <text x={cx} y={cy} textAnchor="middle">
                      <tspan x={cx} y={cy - 12} className="fill-foreground" fontSize={22} fontWeight={700}>{filled.toFixed(0)}%</tspan>
                      <tspan x={cx} y={cy + 8}  className="fill-muted-foreground" fontSize={12}>{label}</tspan>
                    </text>
                  );
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </div>
      {primary && (
        <p className="text-[11px] font-mono text-muted-foreground mt-1 text-center">
          <MetricValue display={primary} hover={hover} />
        </p>
      )}
    </div>
  );
}

// ── Container bar chart ────────────────────────────────────────────────────

const CPU_CONFIG = { cpu: { label: "CPU (m)", color: "hsl(210 100% 50%)" } };

function ContainerCpuChart({ containers }) {
  const data = containers.map((c) => ({ name: c.name, cpu: c.cpu ?? 0 }));
  if (data.length === 0) return null;
  return (
    <Panel title="CPU by Container">
      <ChartContainer config={CPU_CONFIG} className="h-44 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `${v}m`} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tickMargin={8} width={120} tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="cpu" fill="var(--color-cpu)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </Panel>
  );
}

// ── Container table ────────────────────────────────────────────────────────

function ContainerTable({ containers, podContainers }) {
  const reqMap = React.useMemo(() => {
    const m = {};
    for (const c of (podContainers ?? [])) {
      m[c.name] = {
        cpu: parseCpuToMilli(c.resources?.requests?.cpu),
        mem: parseMemToBytes(c.resources?.requests?.memory),
      };
    }
    return m;
  }, [podContainers]);

  return (
    <Panel title="Containers" subtitle={`${containers.length} container${containers.length !== 1 ? "s" : ""}`}>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Container", "CPU", "CPU Req", "Memory", "Mem Req"].map((h) => (
                <th key={h} className={`pb-2 font-medium text-muted-foreground ${h === "Container" ? "text-left pr-4" : "text-right px-2"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => {
              const req = reqMap[c.name] ?? {};
              return (
                <tr key={c.name} className="border-b border-border/40">
                  <td className="py-1.5 pr-4 font-mono max-w-48 truncate">{c.name}</td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    <MetricValue display={fmtCores(c.cpu ?? null)} hover={fmtMilliStr(c.cpu ?? null)} />
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                    {req.cpu ? fmtCores(req.cpu) : "—"}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    <MetricValue display={fmtGB(c.memory ?? null)} hover={fmtMB(c.memory ?? null)} />
                  </td>
                  <td className="py-1.5 pl-2 text-right font-mono text-muted-foreground">
                    {req.mem ? fmtGB(req.mem) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function PodMetricsTab({ pod, namespace, name }) {
  const { available, data: metricsData, loading } = useMetrics(
    namespace ? `/api/k8s/metrics/pods?namespace=${namespace}` : null,
  );

  const podMetric = React.useMemo(
    () => (metricsData ?? []).find((m) => m.name === name) ?? null,
    [metricsData, name],
  );

  const totalCpu = podMetric?.cpu ?? null;
  const totalMem = podMetric?.memory ?? null;
  const containers = podMetric?.containers ?? [];
  const podContainers = pod?.spec?.containers ?? [];

  // Requested totals from pod spec
  const reqCpu = React.useMemo(() => {
    const v = podContainers.reduce((s, c) => s + parseCpuToMilli(c.resources?.requests?.cpu), 0);
    return v || null;
  }, [podContainers]);

  const reqMem = React.useMemo(() => {
    const v = podContainers.reduce((s, c) => s + parseMemToBytes(c.resources?.requests?.memory), 0);
    return v || null;
  }, [podContainers]);

  const cpuPct = reqCpu && totalCpu ? (totalCpu / reqCpu) * 100 : null;
  const memPct = reqMem && totalMem ? (totalMem / reqMem) * 100 : null;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    );
  }

  if (available === false) {
    return (
      <Panel title="Metrics Unavailable">
        <div className="px-4 py-8 text-center text-sm text-muted-foreground space-y-1">
          <p>No metrics source is available for this cluster.</p>
          <p>Deploy <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">metrics-server</code> to enable live CPU &amp; memory usage.</p>
        </div>
      </Panel>
    );
  }

  if (!podMetric) {
    return (
      <Panel title="No Metrics">
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No metrics found for this pod.
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="CPU Usage"  value={fmtCores(totalCpu)} hover={fmtMilliStr(totalCpu)} sub={reqCpu ? `req ${fmtCores(reqCpu)}` : undefined} />
        <StatCard label="Memory"     value={fmtGB(totalMem)}    hover={fmtMB(totalMem)}        sub={reqMem ? `req ${fmtGB(reqMem)}`   : undefined} />
      </div>

      {/* Gauges */}
      {(cpuPct != null || memPct != null) && (
        <Panel title="Resource Utilization" subtitle="used vs requested">
          <div className="flex justify-around flex-wrap">
            {cpuPct != null && (
              <Gauge label="CPU" pct={cpuPct} primary={`${fmtCores(totalCpu)} / ${fmtCores(reqCpu)}`} hover={`${fmtMilliStr(totalCpu)} / ${fmtMilliStr(reqCpu)}`} color="hsl(210 100% 50%)" />
            )}
            {memPct != null && (
              <Gauge label="Memory" pct={memPct} primary={`${fmtGB(totalMem)} / ${fmtGB(reqMem)}`} hover={`${fmtMB(totalMem)} / ${fmtMB(reqMem)}`} color="hsl(142 70% 45%)" />
            )}
          </div>
        </Panel>
      )}

      {/* Per-container breakdown */}
      {containers.length > 1 && <ContainerCpuChart containers={containers} />}
      {containers.length > 0 && <ContainerTable containers={containers} podContainers={podContainers} />}
    </div>
  );
}

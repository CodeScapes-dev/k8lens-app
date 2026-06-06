"use client";

import React from "react";
import { useRouter } from "next/navigation";
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Stat card ──────────────────────────────────────────────────────────────────

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

// ── Radial gauge ───────────────────────────────────────────────────────────────

function Gauge({ label, pct, primary, hover, color = "hsl(210 100% 50%)" }) {
  const filled = Math.min(100, Math.max(0, pct ?? 0));
  const barColor = pctColor(filled, color);
  const chartData = [{ used: filled, remaining: 100 - filled }];
  const chartConfig = {
    used: { label: "Used", color: barColor },
    remaining: { label: "Remaining", color: "hsl(var(--muted))" },
  };
  return (
    <div className="flex flex-col items-center" style={{ width: 180 }}>
      <div style={{ height: 90, overflow: "hidden" }}>
        <ChartContainer config={chartConfig} className="w-full" style={{ height: 160 }}>
          <RadialBarChart data={chartData} endAngle={180} innerRadius={55} outerRadius={80}>
            <RadialBar dataKey="remaining" stackId="a" cornerRadius={5} fill="var(--color-remaining)" className="stroke-transparent stroke-2" />
            <RadialBar dataKey="used" stackId="a" cornerRadius={5} fill="var(--color-used)" className="stroke-transparent stroke-2" />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                  const { cx, cy } = viewBox;
                  return (
                    <text x={cx} y={cy} textAnchor="middle">
                      <tspan x={cx} y={cy - 12} className="fill-foreground" fontSize={22} fontWeight={700}>
                        {filled.toFixed(0)}%
                      </tspan>
                      <tspan x={cx} y={cy + 8} className="fill-muted-foreground" fontSize={12}>
                        {label}
                      </tspan>
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

// ── Top pods bar chart ─────────────────────────────────────────────────────────

const POD_CHART_CONFIG = { cpu: { label: "CPU (m)", color: "hsl(210 100% 50%)" } };

function PodCpuChart({ podMetrics }) {
  const data = [...podMetrics]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 8)
    .map((p) => ({
      name: p.name.length > 28 ? `${p.name.slice(0, 26)}…` : p.name,
      cpu: p.cpu,
    }));
  if (data.length === 0) return null;
  return (
    <Panel title="Top Pods by CPU" subtitle={`top ${data.length} of ${podMetrics.length} pods`}>
      <ChartContainer config={POD_CHART_CONFIG} className="h-56 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `${v}m`} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tickMargin={8} width={160} tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="cpu" fill="var(--color-cpu)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </Panel>
  );
}

// ── Pods table ─────────────────────────────────────────────────────────────────

function PodsTable({ pods, podMetrics, namespace }) {
  const router = useRouter();
  const metricsMap = React.useMemo(() => {
    const m = {};
    for (const pm of podMetrics) m[pm.name] = pm;
    return m;
  }, [podMetrics]);

  const sorted = [...pods].sort((a, b) => {
    const ac = metricsMap[a.metadata?.name]?.cpu ?? -1;
    const bc = metricsMap[b.metadata?.name]?.cpu ?? -1;
    return bc - ac;
  });

  return (
    <Panel title="Pods" subtitle={`${pods.length} pods · sorted by CPU`}>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Pod", "CPU", "Memory"].map((h) => (
                <th key={h} className={`pb-2 font-medium text-muted-foreground ${h === "Pod" ? "text-left pr-4" : "text-right px-2"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((pod) => {
              const pname = pod.metadata?.name;
              const m = metricsMap[pname];
              return (
                <tr
                  key={pod.metadata?.uid ?? pname}
                  className="border-b border-border/40 hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => router.push(`/workloads/pods/${namespace}/${pname}`)}
                >
                  <td className="py-1.5 pr-4 font-mono max-w-64 truncate text-[var(--kl-accent)]">{pname}</td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    <MetricValue display={fmtCores(m?.cpu ?? null)} hover={fmtMilliStr(m?.cpu ?? null)} />
                  </td>
                  <td className="py-1.5 pl-2 text-right font-mono">
                    <MetricValue display={fmtGB(m?.memory ?? null)} hover={fmtMB(m?.memory ?? null)} />
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

// ── Main ───────────────────────────────────────────────────────────────────────

export function WorkloadMetricsTab({ pods = [], namespace }) {
  const { available, data: metricsData, loading } = useMetrics(
    namespace ? `/api/k8s/metrics/pods?namespace=${namespace}` : null,
  );

  const podNames = React.useMemo(() => new Set(pods.map((p) => p.metadata?.name)), [pods]);

  const podMetrics = React.useMemo(
    () => (metricsData ?? []).filter((m) => podNames.has(m.name)),
    [metricsData, podNames],
  );

  // Aggregate totals
  const totalCpu = React.useMemo(() => podMetrics.reduce((s, m) => s + (m.cpu ?? 0), 0), [podMetrics]);
  const totalMem = React.useMemo(() => podMetrics.reduce((s, m) => s + (m.memory ?? 0), 0), [podMetrics]);

  // Requested totals from pod specs
  const { reqCpu, reqMem } = React.useMemo(() => {
    let cpu = 0, mem = 0;
    for (const pod of pods) {
      for (const c of (pod.spec?.containers ?? [])) {
        cpu += parseCpuToMilli(c.resources?.requests?.cpu);
        mem += parseMemToBytes(c.resources?.requests?.memory);
      }
    }
    return { reqCpu: cpu || null, reqMem: mem || null };
  }, [pods]);

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
        <Skeleton className="h-56 rounded-xl" />
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

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          label="CPU Usage"
          value={fmtCores(totalCpu)}
          hover={fmtMilliStr(totalCpu)}
          sub={reqCpu ? `req ${fmtCores(reqCpu)}` : undefined}
        />
        <StatCard
          label="Memory"
          value={fmtGB(totalMem)}
          hover={fmtMB(totalMem)}
          sub={reqMem ? `req ${fmtGB(reqMem)}` : undefined}
        />
      </div>

      {/* Gauges */}
      {(cpuPct != null || memPct != null) && (
        <Panel title="Resource Utilization" subtitle="used vs requested">
          <div className="flex justify-around flex-wrap">
            {cpuPct != null && (
              <Gauge
                label="CPU"
                pct={cpuPct}
                primary={`${fmtCores(totalCpu)} / ${fmtCores(reqCpu)}`}
                hover={`${fmtMilliStr(totalCpu)} / ${fmtMilliStr(reqCpu)}`}
                color="hsl(210 100% 50%)"
              />
            )}
            {memPct != null && (
              <Gauge
                label="Memory"
                pct={memPct}
                primary={`${fmtGB(totalMem)} / ${fmtGB(reqMem)}`}
                hover={`${fmtMB(totalMem)} / ${fmtMB(reqMem)}`}
                color="hsl(142 70% 45%)"
              />
            )}
          </div>
        </Panel>
      )}

      {/* Bar chart + table */}
      {podMetrics.length > 0 && <PodCpuChart podMetrics={podMetrics} />}
      {pods.length > 0 && <PodsTable pods={pods} podMetrics={podMetrics} namespace={namespace} />}
    </div>
  );
}

"use client";

import React from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarRadiusAxis,
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Panel } from "@/components/kl/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricValue } from "@/components/kl/MetricValue";
import { useMetrics } from "@/hooks/use-metrics";
import {
  fmtNano,
  fmtNanoStr,
  fmtCores,
  fmtMilliStr,
  fmtGB,
  fmtMB,
  parseAllocCpu,
  parseAllocMem,
  pctColor,
} from "@/lib/k8s/metrics-utils";

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, hover, sub }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-base font-mono font-semibold leading-tight">
        <MetricValue display={value} hover={hover} />
      </span>
      {sub && (
        <span className="text-[11px] text-muted-foreground font-mono">
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Radial gauge (shadcn RadialBarChart) ───────────────────────────────────────

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
      <ChartContainer
        config={chartConfig}
        className="w-full"
        style={{ height: 160 }}
      >
        <RadialBarChart
          data={chartData}
          endAngle={180}
          innerRadius={55}
          outerRadius={80}
        >
          <RadialBar
            dataKey="remaining"
            stackId="a"
            cornerRadius={5}
            fill="var(--color-remaining)"
            className="stroke-transparent stroke-2"
          />
          <RadialBar
            dataKey="used"
            stackId="a"
            cornerRadius={5}
            fill="var(--color-used)"
            className="stroke-transparent stroke-2"
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox))
                  return null;
                const { cx, cy } = viewBox;
                return (
                  <text x={cx} y={cy} textAnchor="middle">
                    <tspan
                      x={cx}
                      y={cy - 12}
                      className="fill-foreground text-2xl font-bold"
                      fontSize={22}
                      fontWeight={700}
                    >
                      {filled.toFixed(0)}%
                    </tspan>
                    <tspan
                      x={cx}
                      y={cy + 8}
                      className="fill-muted-foreground"
                      fontSize={12}
                    >
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

// ── Top pods BarChart ──────────────────────────────────────────────────────────

const POD_CHART_CONFIG = {
  cpu: { label: "CPU (m)", color: "hsl(210 100% 50%)" },
};

function PodCpuChart({ pods }) {
  const data = pods
    .filter((p) => p.cpu?.usageNanoCores != null)
    .sort((a, b) => b.cpu.usageNanoCores - a.cpu.usageNanoCores)
    .slice(0, 8)
    .map((p) => ({
      name:
        p.podRef.name.length > 28
          ? `${p.podRef.name.slice(0, 26)}…`
          : p.podRef.name,
      cpu: Math.round(p.cpu.usageNanoCores / 1_000_000),
    }));
  if (data.length === 0) return null;
  return (
    <Panel
      title="Top Pods by CPU"
      subtitle={`top ${data.length} of ${pods.length} pods`}
    >
      <ChartContainer config={POD_CHART_CONFIG} className="h-56 w-full">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(v) => `${v}m`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={160}
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="cpu" fill="var(--color-cpu)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </Panel>
  );
}

// ── Pods table ─────────────────────────────────────────────────────────────────

function PodsTable({ pods }) {
  return (
    <Panel
      title="Pods on this Node"
      subtitle={`${pods.length} pods · sorted by CPU`}
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {["Pod", "Namespace", "CPU", "Memory"].map((h) => (
                <th
                  key={h}
                  className={`pb-2 font-medium text-muted-foreground ${h === "CPU" || h === "Memory" ? "text-right pr-1" : "text-left"} ${h === "Pod" ? "pr-4" : "px-2"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...pods]
              .sort(
                (a, b) =>
                  (b.cpu?.usageNanoCores ?? 0) - (a.cpu?.usageNanoCores ?? 0),
              )
              .map((p) => (
                <tr
                  key={`${p.podRef.namespace}/${p.podRef.name}`}
                  className="border-b border-border/40 hover:bg-muted/40 transition-colors"
                >
                  <td className="py-1.5 pr-4 font-mono max-w-48 truncate">
                    {p.podRef.name}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground font-mono">
                    {p.podRef.namespace}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    <MetricValue
                      display={fmtNano(p.cpu?.usageNanoCores ?? null)}
                      hover={fmtNanoStr(p.cpu?.usageNanoCores ?? null)}
                    />
                  </td>
                  <td className="py-1.5 pl-2 text-right font-mono">
                    <MetricValue
                      display={fmtGB(p.memory?.workingSetBytes ?? null)}
                      hover={fmtMB(p.memory?.workingSetBytes ?? null)}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function MetricsTab({ nodeName, allocatable = {} }) {
  const {
    available: statsOk,
    data: stats,
    loading: statsLoading,
  } = useMetrics(`/api/k8s/node-stats/${nodeName}`);
  const {
    available: msOk,
    data: msNodes,
    loading: msLoading,
  } = useMetrics(`/api/k8s/metrics/nodes`, {
    enabled: statsOk === false && !statsLoading,
  });

  const loading = statsLoading || (statsOk === false && msLoading);
  const allocCpu = parseAllocCpu(allocatable.cpu); // millicores
  const allocMem = parseAllocMem(allocatable.memory); // bytes

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  // ── Rich view (kubelet Summary API) ──────────────────────────────────────────
  if (statsOk && stats) {
    const cpuNano = stats.cpu?.usageNanoCores ?? null;
    const cpuMilli = cpuNano != null ? Math.round(cpuNano / 1_000_000) : null;
    const workingSet = stats.memory?.workingSetBytes ?? null;
    const rss = stats.memory?.rssBytes ?? null;
    const eth = stats.network?.interfaces?.[0] ?? null;
    const fsUsed = stats.fs?.usedBytes ?? null;
    const fsCap = stats.fs?.capacityBytes ?? null;

    const cpuPct =
      allocCpu && cpuMilli != null ? (cpuMilli / allocCpu) * 100 : null;
    const memPct =
      allocMem && workingSet != null ? (workingSet / allocMem) * 100 : null;
    const diskPct = fsCap && fsUsed != null ? (fsUsed / fsCap) * 100 : null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            label="CPU Usage"
            value={fmtNano(cpuNano)}
            hover={fmtNanoStr(cpuNano)}
            sub={allocCpu ? `alloc ${fmtCores(allocCpu)}` : undefined}
          />
          <StatCard
            label="Memory (WSS)"
            value={fmtGB(workingSet)}
            hover={fmtMB(workingSet)}
            sub={
              rss
                ? `RSS ${fmtGB(rss)}`
                : allocMem
                  ? `alloc ${fmtGB(allocMem)}`
                  : undefined
            }
          />
          <StatCard
            label="Net RX"
            value={fmtGB(eth?.rxBytes ?? null)}
            hover={fmtMB(eth?.rxBytes ?? null)}
            sub={eth?.name ?? undefined}
          />
          <StatCard
            label="Net TX"
            value={fmtGB(eth?.txBytes ?? null)}
            hover={fmtMB(eth?.txBytes ?? null)}
            sub={eth?.name ?? undefined}
          />
        </div>

        {(cpuPct != null || memPct != null || diskPct != null) && (
          <Panel title="Resource Utilization">
            <div className="flex justify-around flex-wrap ">
              {cpuPct != null && (
                <Gauge
                  label="CPU"
                  pct={cpuPct}
                  primary={`${fmtCores(cpuMilli)} / ${fmtCores(allocCpu)}`}
                  hover={`${fmtMilliStr(cpuMilli)} / ${fmtMilliStr(allocCpu)}`}
                  color="hsl(210 100% 50%)"
                />
              )}
              {memPct != null && (
                <Gauge
                  label="Memory"
                  pct={memPct}
                  primary={`${fmtGB(workingSet)} / ${fmtGB(allocMem)}`}
                  hover={`${fmtMB(workingSet)} / ${fmtMB(allocMem)}`}
                  color="hsl(142 70% 45%)"
                />
              )}
              {diskPct != null && (
                <Gauge
                  label="Filesystem"
                  pct={diskPct}
                  primary={`${fmtGB(fsUsed)} / ${fmtGB(fsCap)}`}
                  hover={`${fmtMB(fsUsed)} / ${fmtMB(fsCap)}`}
                  color="hsl(262 80% 58%)"
                />
              )}
            </div>
          </Panel>
        )}

        {stats.pods?.length > 0 && <PodCpuChart pods={stats.pods} />}
        {stats.pods?.length > 0 && <PodsTable pods={stats.pods} />}
      </div>
    );
  }

  // ── Fallback (Metrics Server only) ───────────────────────────────────────────
  if (msOk && msNodes) {
    const node = msNodes.find((n) => n.name === nodeName);
    const cpuMilli = node?.cpu ?? null;
    const memBytes = node?.memory ?? null;
    const cpuPct =
      allocCpu && cpuMilli != null ? (cpuMilli / allocCpu) * 100 : null;
    const memPct =
      allocMem && memBytes != null ? (memBytes / allocMem) * 100 : null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            label="CPU"
            value={fmtCores(cpuMilli)}
            hover={fmtMilliStr(cpuMilli)}
            sub={allocCpu ? `alloc ${fmtCores(allocCpu)}` : undefined}
          />
          <StatCard
            label="Memory"
            value={fmtGB(memBytes)}
            hover={fmtMB(memBytes)}
            sub={allocMem ? `alloc ${fmtGB(allocMem)}` : undefined}
          />
        </div>
        {(cpuPct != null || memPct != null) && (
          <Panel
            title="Resource Utilization"
            subtitle="via Metrics Server · network and filesystem unavailable"
          >
            <div className="flex justify-around flex-wrap gap-2 py-2">
              {cpuPct != null && (
                <Gauge
                  label="CPU"
                  pct={cpuPct}
                  primary={`${fmtCores(cpuMilli)} / ${fmtCores(allocCpu)}`}
                  hover={`${fmtMilliStr(cpuMilli)} / ${fmtMilliStr(allocCpu)}`}
                  color="hsl(210 100% 50%)"
                />
              )}
              {memPct != null && (
                <Gauge
                  label="Memory"
                  pct={memPct}
                  primary={`${fmtGB(memBytes)} / ${fmtGB(allocMem)}`}
                  hover={`${fmtMB(memBytes)} / ${fmtMB(allocMem)}`}
                  color="hsl(142 70% 45%)"
                />
              )}
            </div>
          </Panel>
        )}
      </div>
    );
  }

  return (
    <Panel title="Metrics Unavailable">
      <div className="px-4 py-8 text-center text-sm text-muted-foreground space-y-1">
        <p>No metrics source is available for this cluster.</p>
        <p>
          Deploy{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            metrics-server
          </code>{" "}
          to enable CPU &amp; memory usage, or ensure{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            nodes/proxy
          </code>{" "}
          RBAC is granted for rich node statistics.
        </p>
      </div>
    </Panel>
  );
}

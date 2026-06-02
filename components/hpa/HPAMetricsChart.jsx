"use client";

import React from "react";
import {
  PieChart, Pie, Label,
  AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Panel } from "@/components/kl/Panel";

function DonutMetric({ title, current, target, color, trackColor }) {
  const pct = Math.min(100, current);
  const remaining = Math.max(0, target - current);
  const isOver = current >= target;
  const isWarn = current >= target * 0.8;
  const fillColor = isOver
    ? "hsl(0 80% 55%)"
    : isWarn
    ? "hsl(35 90% 55%)"
    : color;

  return (
    <Panel title={title} subtitle="current vs target">
      <ChartContainer config={{ value: { label: title, color: fillColor } }} className="mx-auto aspect-square max-h-[160px]">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={[
              { name: "Current", value: pct, fill: fillColor },
              { name: "Remaining", value: remaining, fill: trackColor },
            ]}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            strokeWidth={2}
            stroke="hsl(var(--background))"
          >
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null;
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">{current}%</tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">/{target}%</tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
    </Panel>
  );
}

function TrendChart({ title, dataKey, data, target, color, gradientId }) {
  return (
    <Panel title={title} subtitle="last 15 min">
      <ChartContainer config={{ [dataKey]: { label: `${dataKey} %`, color } }} className="h-[160px] w-full">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            minTickGap={32}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(v) => new Date(v).toLocaleTimeString()}
                formatter={(v) => `${Number(v).toFixed(1)}%`}
              />
            }
          />
          {target > 0 && (
            <ReferenceLine
              y={target}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              label={{ value: `target ${target}%`, position: "insideTopRight", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
            />
          )}
          <Area dataKey={dataKey} type="monotone" fill={`url(#${gradientId})`} stroke={color} strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
    </Panel>
  );
}

export function HPAMetricsChart({ metrics = [], currentMetrics = [] }) {
  const cpuMetric = metrics.find((m) => m.type === "Resource" && m.resource?.name === "cpu");
  const memMetric = metrics.find((m) => m.type === "Resource" && m.resource?.name === "memory");
  const cpuCurrent = currentMetrics.find((m) => m.resource?.name === "cpu");
  const memCurrent = currentMetrics.find((m) => m.resource?.name === "memory");

  const cpuTarget = cpuMetric?.resource?.target?.averageUtilization ?? 0;
  const memTarget = memMetric?.resource?.target?.averageUtilization ?? 0;
  const cpuValue = cpuCurrent?.resource?.current?.averageUtilization ?? cpuCurrent?.resource?.currentAverageUtilization ?? 0;
  const memValue = memCurrent?.resource?.current?.averageUtilization ?? memCurrent?.resource?.currentAverageUtilization ?? 0;

  const [cpuData, setCpuData] = React.useState([]);
  const [memData, setMemData] = React.useState([]);

  React.useEffect(() => {
    const now = Date.now();
    const gen = (base) => Array.from({ length: 16 }, (_, i) => ({
      date: new Date(now - (15 - i) * 60000).toISOString(),
      value: Math.max(0, Math.min(100, base + (Math.random() * 10 - 5))),
    }));
    React.startTransition(() => {
      setCpuData(gen(cpuValue).map((d) => ({ ...d, cpu: +d.value.toFixed(1) })));
      setMemData(gen(memValue).map((d) => ({ ...d, memory: +d.value.toFixed(1) })));
    });
  }, [cpuValue, memValue]);

  if (cpuTarget === 0 && memTarget === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cpuTarget > 0 && (
        <>
          <DonutMetric title="CPU Utilization" current={cpuValue} target={cpuTarget} color="hsl(210 100% 50%)" trackColor="hsl(210 100% 85%)" />
          <TrendChart title="CPU Trend" dataKey="cpu" data={cpuData} target={cpuTarget} color="hsl(210 100% 50%)" gradientId="fillCpu" />
        </>
      )}
      {memTarget > 0 && (
        <>
          <DonutMetric title="Memory Utilization" current={memValue} target={memTarget} color="hsl(142 70% 45%)" trackColor="hsl(142 70% 80%)" />
          <TrendChart title="Memory Trend" dataKey="memory" data={memData} target={memTarget} color="hsl(142 70% 45%)" gradientId="fillMem" />
        </>
      )}
    </div>
  );
}

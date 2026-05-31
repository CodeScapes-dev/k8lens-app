import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { calculateAge } from "@/lib/k8s/utils";

function resolveMetric(statusMetric, specMetric) {
  const type = statusMetric?.type ?? specMetric?.type ?? "Unknown";
  if (type === "Resource") {
    const name = statusMetric?.resource?.name ?? specMetric?.resource?.name ?? "—";
    const currentUtil = statusMetric?.resource?.current?.averageUtilization;
    const currentVal = statusMetric?.resource?.current?.averageValue;
    const targetUtil = specMetric?.resource?.target?.averageUtilization;
    const targetVal = specMetric?.resource?.target?.averageValue;
    return { type, name, current: currentUtil != null ? `${currentUtil}%` : currentVal ?? "—", target: targetUtil != null ? `${targetUtil}%` : targetVal ?? "—" };
  }
  if (type === "External") {
    return { type, name: statusMetric?.external?.metric?.name ?? specMetric?.external?.metric?.name ?? "—", current: statusMetric?.external?.current?.averageValue ?? statusMetric?.external?.current?.value ?? "—", target: specMetric?.external?.target?.averageValue ?? specMetric?.external?.target?.value ?? "—" };
  }
  if (type === "Pods") {
    return { type, name: statusMetric?.pods?.metric?.name ?? specMetric?.pods?.metric?.name ?? "—", current: statusMetric?.pods?.current?.averageValue ?? "—", target: specMetric?.pods?.target?.averageValue ?? "—" };
  }
  if (type === "Object") {
    return { type, name: statusMetric?.object?.metric?.name ?? specMetric?.object?.metric?.name ?? "—", current: statusMetric?.object?.current?.averageValue ?? statusMetric?.object?.current?.value ?? "—", target: specMetric?.object?.target?.averageValue ?? specMetric?.object?.target?.value ?? "—" };
  }
  return { type, name: "—", current: "—", target: "—" };
}

export function OverviewTab({ hpa }) {
  if (!hpa) return null;
  const meta = hpa.metadata ?? {};
  const spec = hpa.spec ?? {};
  const status = hpa.status ?? {};
  const current = status.currentReplicas ?? 0;
  const desired = status.desiredReplicas ?? 0;
  const min = spec.minReplicas ?? 1;
  const max = spec.maxReplicas ?? 0;
  const pct = max > min ? Math.min(100, Math.round(((current - min) / (max - min)) * 100)) : current > 0 ? 100 : 0;
  const metrics = (spec.metrics ?? []).map((sm, i) => resolveMetric((status.currentMetrics ?? [])[i], sm));

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <div className="flex flex-col gap-4">
        <Panel title="Target">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px,160px) 1fr", fontSize: 12 }}>
            {[
              ["Namespace", meta.namespace],
              ["Scale Target", `${spec.scaleTargetRef?.kind ?? ""}/${spec.scaleTargetRef?.name ?? "—"}`],
              ["API Version", spec.scaleTargetRef?.apiVersion ?? "apps/v1"],
              ["Min Replicas", min],
              ["Max Replicas", max],
              ["Last Scale", status.lastScaleTime ? calculateAge(status.lastScaleTime) + " ago" : "—"],
              ["Observed Gen.", status.observedGeneration ?? "—"],
            ].map(([l, v]) => (
              <React.Fragment key={l}>
                <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
              </React.Fragment>
            ))}
          </div>
        </Panel>
        {metrics.length > 0 && (
          <Panel title="Metrics" subtitle={`${metrics.length} configured`}>
            <div className="flex flex-col">
              {metrics.map((m, i) => {
                const overTarget = !isNaN(parseFloat(m.current)) && !isNaN(parseFloat(m.target)) && parseFloat(m.current) > parseFloat(m.target);
                return (
                  <div key={i} className="flex items-center gap-2 py-2" style={{ borderTop: "1px solid var(--kl-border)" }}>
                    <KLBadge tone="accent">{m.type}</KLBadge>
                    <span className="kl-mono text-xs flex-1 break-all">{m.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="kl-mono text-xs" style={{ color: overTarget ? "var(--kl-warn)" : "var(--kl-text)" }}>{m.current}</span>
                      <span style={{ fontSize: 10, color: "var(--kl-text-faint)" }}>/ {m.target}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <Panel title="Replica Scale">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[{ label: "Min", value: min }, { label: "Current", value: current }, { label: "Max", value: max }].map(({ label, value }) => (
              <div key={label} className="text-center py-2.5 px-2 rounded-lg" style={{ background: "var(--kl-surface-2)", border: "1px solid var(--kl-border)" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
                <div className="kl-mono font-bold" style={{ fontSize: 18, color: current !== desired && label === "Current" ? "var(--kl-warn)" : "var(--kl-text)" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--kl-surface-3)" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "var(--kl-warn)" : "var(--kl-accent)", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <div className="flex justify-between mt-1" style={{ fontSize: 10, color: "var(--kl-text-faint)" }}>
            <span>min: {min}</span><span>max: {max}</span>
          </div>
          {current !== desired && (
            <div className="mt-3 px-3 py-2 rounded-lg" style={{ background: "var(--kl-warn-tint, color-mix(in srgb, var(--kl-warn) 12%, transparent))", border: "1px solid var(--kl-warn)", fontSize: 12, color: "var(--kl-warn)" }}>
              Scaling: {current} → {desired} replicas
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

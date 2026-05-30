"use client";

import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";

export function BlastRadiusTab({ deployment, pods = [], replicaSets = [] }) {
  if (!deployment) return null;
  const spec = deployment.spec ?? {};
  const status = deployment.status ?? {};
  const strategy = spec.strategy ?? {};
  const desired = spec.replicas ?? 0;
  const ready = status.readyReplicas ?? 0;

  // Rolling update worst-case impact
  const maxUnavailable = strategy.rollingUpdate?.maxUnavailable ?? 0;
  const maxSurge = strategy.rollingUpdate?.maxSurge ?? 0;

  const parseRollingValue = (val, base) => {
    if (typeof val === "number") return val;
    if (typeof val === "string" && val.endsWith("%")) {
      return Math.floor((parseFloat(val) / 100) * base);
    }
    return 0;
  };

  const maxUnavailableNum = parseRollingValue(maxUnavailable, desired);
  const maxSurgeNum = parseRollingValue(maxSurge, desired);
  const minAvailable = desired - maxUnavailableNum;
  const maxTotal = desired + maxSurgeNum;

  // Pod phase breakdown
  const phaseCounts = pods.reduce((acc, pod) => {
    const phase = pod.status?.phase ?? "Unknown";
    acc[phase] = (acc[phase] ?? 0) + 1;
    return acc;
  }, {});

  // Restart heat map
  const podRestarts = pods.map((pod) => ({
    name: pod.metadata?.name,
    restarts: (pod.status?.containerStatuses ?? []).reduce((s, c) => s + (c.restartCount ?? 0), 0),
    phase: pod.status?.phase ?? "Unknown",
  })).sort((a, b) => b.restarts - a.restarts);

  const maxRestarts = Math.max(...podRestarts.map((p) => p.restarts), 1);

  // Node spread
  const nodeSpread = pods.reduce((acc, pod) => {
    const node = pod.spec?.nodeName ?? "unscheduled";
    acc[node] = (acc[node] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {/* Left */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {strategy.type === "RollingUpdate" && (
          <Panel title="Rolling Update Impact">
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              {[
                { label: "Max Unavailable", value: `${maxUnavailableNum} pod${maxUnavailableNum !== 1 ? "s" : ""}`, sub: String(maxUnavailable), kind: "warn" },
                { label: "Max Surge",       value: `${maxSurgeNum} pod${maxSurgeNum !== 1 ? "s" : ""}`,       sub: String(maxSurge),        kind: "info" },
                { label: "Min Available",   value: `${minAvailable} pod${minAvailable !== 1 ? "s" : ""}`,   sub: "during rollout",        kind: "ok" },
                { label: "Max Total",       value: `${maxTotal} pod${maxTotal !== 1 ? "s" : ""}`,           sub: "during rollout",        kind: "neutral" },
              ].map(({ label, value, sub, kind }) => (
                <div key={label} style={{ padding: "12px 14px", background: "var(--kl-surface-2)", borderRadius: 8, border: "1px solid var(--kl-border)" }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
                  <div className="kl-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--kl-text)", marginBottom: 2 }}>{value}</div>
                  <div className="kl-mono" style={{ fontSize: 10, color: "var(--kl-text-faint)" }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--kl-text-muted)", lineHeight: 1.6, padding: "10px 12px", background: "var(--kl-surface-2)", borderRadius: 7, border: "1px solid var(--kl-border)" }}>
              During a rollout, at least <strong style={{ color: "var(--kl-text)" }}>{minAvailable}</strong> pod{minAvailable !== 1 ? "s" : ""} will remain available,
              with at most <strong style={{ color: "var(--kl-text)" }}>{maxTotal}</strong> pod{maxTotal !== 1 ? "s" : ""} total running at any point.
            </div>
          </Panel>
        )}

        {strategy.type === "Recreate" && (
          <Panel title="Recreate Strategy Impact">
            <div style={{ padding: "10px 12px", background: "var(--kl-err-tint)", border: "1px solid var(--kl-err)", borderRadius: 7, fontSize: 12, color: "var(--kl-err)", lineHeight: 1.6 }}>
              ⚠️ Recreate strategy causes <strong>full downtime</strong> during rollout —
              all {desired} pod{desired !== 1 ? "s" : ""} are terminated before new ones start.
            </div>
          </Panel>
        )}

        <Panel title="Pod Phase Distribution">
          {Object.entries(phaseCounts).map(([phase, count]) => {
            const pct = pods.length > 0 ? Math.round((count / pods.length) * 100) : 0;
            const color = phase === "Running" ? "var(--kl-ok)" : phase === "Pending" ? "var(--kl-warn)" : "var(--kl-err)";
            return (
              <div key={phase} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12 }}>{phase}</span>
                  <span className="kl-mono" style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--kl-surface-3)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
          {pods.length === 0 && <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No pods found</span>}
        </Panel>
      </div>

      {/* Right */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title="Node Spread" subtitle={`${Object.keys(nodeSpread).length} node${Object.keys(nodeSpread).length !== 1 ? "s" : ""}`}>
          {Object.keys(nodeSpread).length === 0 && (
            <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No pods scheduled</span>
          )}
          {Object.entries(nodeSpread)
            .sort((a, b) => b[1] - a[1])
            .map(([node, count]) => (
              <div key={node} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--kl-border)" }}>
                <span style={{ fontSize: 14, color: "var(--kl-text-muted)" }}>⬡</span>
                <span className="kl-mono" style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node}</span>
                <KLBadge tone="neutral">{count} pod{count !== 1 ? "s" : ""}</KLBadge>
              </div>
            ))}
          {Object.keys(nodeSpread).length > 1 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--kl-ok-tint)", border: "1px solid var(--kl-ok)", borderRadius: 7, fontSize: 12, color: "var(--kl-ok)" }}>
              Pods spread across {Object.keys(nodeSpread).length} nodes — failure of any single node affects at most {Math.max(...Object.values(nodeSpread))} pod{Math.max(...Object.values(nodeSpread)) !== 1 ? "s" : ""}.
            </div>
          )}
          {Object.keys(nodeSpread).length === 1 && desired > 1 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--kl-warn-tint)", border: "1px solid var(--kl-warn)", borderRadius: 7, fontSize: 12, color: "var(--kl-warn)" }}>
              All pods on a single node — node failure would take down all {desired} replicas.
            </div>
          )}
        </Panel>

        <Panel title="Restart Heatmap" subtitle="pods by restart count">
          {podRestarts.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No pods</span>
          )}
          {podRestarts.map((p) => {
            const heat = maxRestarts > 0 ? p.restarts / maxRestarts : 0;
            const color = heat === 0 ? "var(--kl-ok)" : heat < 0.4 ? "var(--kl-warn)" : "var(--kl-err)";
            return (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--kl-border)" }}>
                <KLStatus kind={p.phase === "Running" ? "ok" : "warn"} dotOnly />
                <span className="kl-mono" style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <span className="kl-mono" style={{ fontSize: 12, fontWeight: 600, color }}>{p.restarts}</span>
              </div>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}

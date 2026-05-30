"use client";

import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge, formatTimestamp } from "@/lib/k8s/utils";
import { CostCard } from "@/components/cost-estimation/CostCard";

function kv(label, value) {
  return (
    <div style={{ display: "contents" }}>
      <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>{label}</span>
      <span className="kl-mono" style={{ fontSize: 12, color: "var(--kl-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function ReplicaBar({ ready, desired }) {
  const pct = desired > 0 ? Math.min(100, Math.round((ready / desired) * 100)) : 0;
  const color = pct === 100 ? "var(--kl-ok)" : pct === 0 ? "var(--kl-err)" : "var(--kl-warn)";
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 6, borderRadius: 3, background: "var(--kl-surface-3)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontSize: 10, color: "var(--kl-text-faint)" }}>{pct}% ready</span>
        <span className="kl-mono" style={{ fontSize: 10, color: "var(--kl-text-muted)" }}>{ready}/{desired}</span>
      </div>
    </div>
  );
}

function deploymentStatusKind(dep) {
  const desired = dep?.spec?.replicas ?? 0;
  const ready = dep?.status?.readyReplicas ?? 0;
  const updated = dep?.status?.updatedReplicas ?? 0;
  if (desired === 0 || (ready === desired && updated === desired)) return "ok";
  if (ready === 0) return "err";
  return "warn";
}

function deploymentStatusLabel(dep) {
  const k = deploymentStatusKind(dep);
  return k === "ok" ? "Healthy" : k === "warn" ? "Progressing" : "Degraded";
}

export function OverviewTab({ deployment, replicaSets = [], pods = [], events = [], onTabChange }) {
  if (!deployment) return null;
  const meta = deployment.metadata ?? {};
  const spec = deployment.spec ?? {};
  const status = deployment.status ?? {};
  const conditions = status.conditions ?? [];
  const owners = meta.ownerReferences ?? [];
  const strategy = spec.strategy ?? {};

  const statusKind = deploymentStatusKind(deployment);
  const desired = spec.replicas ?? 0;
  const ready = status.readyReplicas ?? 0;
  const updated = status.updatedReplicas ?? 0;
  const available = status.availableReplicas ?? 0;

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.lastTimestamp ?? b.firstTimestamp ?? 0) - new Date(a.lastTimestamp ?? a.firstTimestamp ?? 0))
    .slice(0, 5);

  const activeRS = replicaSets.find((rs) => (rs.status?.readyReplicas ?? 0) > 0);
  const currentRevision = meta.annotations?.["deployment.kubernetes.io/revision"];

  const containers = spec.template?.spec?.containers ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CostCard containers={containers} replicas={desired} />
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      {/* Left */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title="Deployment Info">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr" }}>
            {kv("Name", meta.name)}
            {kv("Namespace", meta.namespace)}
            {kv("UID", meta.uid)}
            {kv("Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—")}
            {kv("Revision", currentRevision ?? "—")}
            {kv("Strategy", strategy.type ?? "—")}
            {kv("Min Ready", spec.minReadySeconds ? `${spec.minReadySeconds}s` : "—")}
            {kv("Progress Deadline", spec.progressDeadlineSeconds ? `${spec.progressDeadlineSeconds}s` : "—")}
          </div>
        </Panel>

        <Panel
          title="Replica Status"
          subtitle={`${ready}/${desired} ready`}
        >
          <ReplicaBar ready={ready} desired={desired} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 14 }}>
            {[
              { label: "Desired",   value: desired },
              { label: "Ready",     value: ready },
              { label: "Updated",   value: updated },
              { label: "Available", value: available },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center", padding: "10px 8px", background: "var(--kl-surface-2)", borderRadius: 8, border: "1px solid var(--kl-border)" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
                <div className="kl-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--kl-text)" }}>{value}</div>
              </div>
            ))}
          </div>
        </Panel>

        {pods.length > 0 && (
          <Panel title="Pods" subtitle={`${pods.length} pod${pods.length !== 1 ? "s" : ""}`}>
            <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 80px 60px", gap: "6px 10px", marginBottom: 6 }}>
              {["", "Name", "Status", "Restarts"].map((h, i) => (
                <span key={i} className="kl-mono" style={{ fontSize: 10, color: "var(--kl-text-faint)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</span>
              ))}
            </div>
            {pods.slice(0, 10).map((pod) => {
              const phase = pod.status?.phase ?? "Unknown";
              const restarts = (pod.status?.containerStatuses ?? []).reduce((s, c) => s + (c.restartCount ?? 0), 0);
              const pkind = phase === "Running" ? "ok" : phase === "Pending" ? "warn" : "err";
              return (
                <div key={pod.metadata?.uid} style={{ display: "grid", gridTemplateColumns: "20px 1fr 80px 60px", gap: "6px 10px", padding: "6px 0", borderTop: "1px solid var(--kl-border)", alignItems: "center" }}>
                  <KLStatus kind={pkind} dotOnly />
                  <span className="kl-mono" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pod.metadata?.name}</span>
                  <KLBadge tone={pkind}>{phase}</KLBadge>
                  <span className="kl-mono" style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>{restarts}</span>
                </div>
              );
            })}
            {pods.length > 10 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--kl-text-faint)", textAlign: "center" }}>
                +{pods.length - 10} more pods
              </div>
            )}
          </Panel>
        )}

        {recentEvents.length > 0 && (
          <Panel title="Recent Events" subtitle="last 5">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentEvents.map((ev, i) => (
                <div key={i} style={{ display: "flex", alignItems: "start", gap: 8 }}>
                  <KLStatus kind={ev.type === "Warning" ? "warn" : "info"} dotOnly />
                  <span className="kl-mono" style={{ fontSize: 11, color: "var(--kl-text-muted)", width: 100, flexShrink: 0 }}>{ev.reason}</span>
                  <span style={{ fontSize: 11.5, color: "var(--kl-text-2)" }}>{ev.message}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* Right */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title="Status">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <KLStatus kind={statusKind} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{deploymentStatusLabel(deployment)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {conditions.map((c) => (
              <div key={c.type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <KLStatus kind={c.status === "True" ? "ok" : "err"} dotOnly />
                <span style={{ fontSize: 12.5, flex: 1 }}>{c.type}</span>
                <span style={{ fontSize: 11, color: "var(--kl-text-faint)" }}>
                  {c.lastUpdateTime ? formatTimestamp(c.lastUpdateTime) : ""}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Selector">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(spec.selector?.matchLabels ?? {}).map(([k, v]) => (
              <KLBadge key={k} tone="accent">{k}={v}</KLBadge>
            ))}
            {Object.keys(spec.selector?.matchLabels ?? {}).length === 0 && (
              <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No selectors</span>
            )}
          </div>
        </Panel>

        {owners.length > 0 && (
          <Panel title="Owner References">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {owners.map((o) => (
                <div key={o.uid} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <KLBadge tone="accent">{o.kind}</KLBadge>
                  <span className="kl-mono" style={{ fontSize: 12 }}>{o.name}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {strategy.type === "RollingUpdate" && strategy.rollingUpdate && (
          <Panel title="Rolling Update Strategy">
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 12px" }}>
              {kv("Max Surge",       String(strategy.rollingUpdate.maxSurge ?? "—"))}
              {kv("Max Unavailable", String(strategy.rollingUpdate.maxUnavailable ?? "—"))}
            </div>
          </Panel>
        )}
      </div>
    </div>
    </div>
  );
}

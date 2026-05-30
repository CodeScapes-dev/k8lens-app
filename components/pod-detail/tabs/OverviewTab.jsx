"use client";

import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge, formatTimestamp, parseK8sResourceValue } from "@/lib/k8s/utils";
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

function ResourceMeter({ label, used, limit }) {
  const usedNum = parseK8sResourceValue(used, label === "CPU" ? "cpu" : "memory");
  const limitNum = parseK8sResourceValue(limit, label === "CPU" ? "cpu" : "memory");
  const pct = limitNum > 0 ? Math.min(100, Math.round((usedNum / limitNum) * 100)) : 0;
  const barColor = pct > 80 ? "var(--kl-err)" : pct > 60 ? "var(--kl-warn)" : "var(--kl-accent)";
  const fmt = (v, raw) => {
    if (!raw) return "—";
    if (label === "CPU") return raw.endsWith("m") ? raw : `${Math.round(v * 1000)}m`;
    const gi = v / (1024 ** 3);
    if (gi >= 0.1) return `${gi.toFixed(2)}Gi`;
    const mi = v / (1024 ** 2);
    return `${Math.round(mi)}Mi`;
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="kl-mono" style={{ fontSize: 10, color: "var(--kl-text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        <span className="kl-mono" style={{ fontSize: 10.5, color: "var(--kl-text-2)" }}>
          {fmt(usedNum, used)} / {fmt(limitNum, limit)}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--kl-surface-3)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      {limitNum > 0 && (
        <div style={{ textAlign: "right", marginTop: 3, fontSize: 10, color: "var(--kl-text-faint)" }}>{pct}% of limit</div>
      )}
    </div>
  );
}

function ContainerCard({ cs, spec, onLogsClick }) {
  const state = cs?.state;
  const stateKey = state ? Object.keys(state)[0] : "unknown";
  const tone = stateKey === "running" ? "ok" : stateKey === "waiting" ? "warn" : stateKey === "terminated" ? (state.terminated?.exitCode === 0 ? "neutral" : "err") : "neutral";
  const resources = spec?.resources ?? {};

  return (
    <div style={{ padding: "12px 14px", background: "var(--kl-surface-2)", borderRadius: 8, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <KLStatus kind={cs?.ready ? "ok" : "warn"} dotOnly />
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{spec?.name}</span>
        <KLBadge tone={tone}>{stateKey}</KLBadge>
        {onLogsClick && (
          <button onClick={onLogsClick} style={{ fontSize: 11, color: "var(--kl-accent)", background: "none", border: "none", cursor: "pointer", padding: "2px 8px", borderRadius: 4 }}>
            Logs
          </button>
        )}
      </div>
      <div className="kl-mono" style={{ fontSize: 11, color: "var(--kl-text-muted)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {spec?.image}
      </div>
      {(resources.requests?.cpu || resources.limits?.cpu) && (
        <ResourceMeter label="CPU" used={resources.requests?.cpu} limit={resources.limits?.cpu} />
      )}
      {(resources.requests?.memory || resources.limits?.memory) && (
        <ResourceMeter label="Memory" used={resources.requests?.memory} limit={resources.limits?.memory} />
      )}
    </div>
  );
}

export function OverviewTab({ pod, events, onTabChange }) {
  if (!pod) return null;
  const meta = pod.metadata ?? {};
  const spec = pod.spec ?? {};
  const status = pod.status ?? {};
  const containerStatuses = status.containerStatuses ?? [];
  const containers = spec.containers ?? [];

  const conditions = status.conditions ?? [];
  const owners = meta.ownerReferences ?? [];
  const volumes = spec.volumes ?? [];

  const recentEvents = [...(events ?? [])]
    .sort((a, b) => new Date(b.lastTimestamp ?? b.firstTimestamp ?? 0) - new Date(a.lastTimestamp ?? a.firstTimestamp ?? 0))
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CostCard containers={containers} replicas={1} />
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      {/* Left column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title="Metadata">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr" }}>
            {kv("Name", meta.name)}
            {kv("Namespace", meta.namespace)}
            {kv("UID", meta.uid)}
            {kv("Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—")}
            {kv("Node", spec.nodeName)}
            {kv("Pod IP", status.podIP)}
            {kv("Host IP", status.hostIP)}
            {kv("Service Account", spec.serviceAccountName)}
            {kv("DNS Policy", spec.dnsPolicy)}
            {kv("QoS Class", status.qosClass)}
          </div>
        </Panel>

        <Panel
          title="Containers"
          subtitle={`${containers.length} container${containers.length !== 1 ? "s" : ""} · ${containerStatuses.filter(cs => cs.ready).length} ready`}
        >
          {containers.map((c) => {
            const cs = containerStatuses.find((s) => s.name === c.name);
            return (
              <ContainerCard
                key={c.name}
                cs={cs}
                spec={c}
                onLogsClick={() => onTabChange?.("Logs")}
              />
            );
          })}
        </Panel>

        {recentEvents.length > 0 && (
          <Panel title="Recent Events" subtitle="last 24h">
            <div className="grid gap-x-2 gap-y-1.5 items-start" style={{ gridTemplateColumns: "16px minmax(60px, 100px) 1fr" }}>
              {recentEvents.map((ev, i) => (
                <React.Fragment key={i}>
                  <KLStatus kind={ev.type === "Warning" ? "warn" : "info"} dotOnly />
                  <span className="kl-mono" style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>
                    {ev.reason}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--kl-text-2)" }}>{ev.message}</span>
                </React.Fragment>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* Right column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title="Conditions">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {conditions.length === 0 && <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No conditions</span>}
            {conditions.map((c) => (
              <div key={c.type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <KLStatus kind={c.status === "True" ? "ok" : "err"} dotOnly />
                <span style={{ fontSize: 12.5, flex: 1 }}>{c.type.replace(/([A-Z])/g, " $1").trim()}</span>
                <span style={{ fontSize: 11, color: "var(--kl-text-faint)" }}>{c.lastTransitionTime ? formatTimestamp(c.lastTransitionTime) : ""}</span>
              </div>
            ))}
          </div>
        </Panel>

        {owners.length > 0 && (
          <Panel title="Owner References">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {owners.map((o) => (
                <div key={o.uid} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <KLBadge tone="accent">{o.kind}</KLBadge>
                  <span className="kl-mono" style={{ fontSize: 12, color: "var(--kl-text)" }}>{o.name}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {volumes.length > 0 && (
          <Panel title="Volumes" subtitle={`${volumes.length} volume${volumes.length !== 1 ? "s" : ""}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {volumes.map((v) => {
                const type = Object.keys(v).find((k) => k !== "name") ?? "unknown";
                return (
                  <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: "var(--kl-text-muted)" }}>◈</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{v.name}</span>
                    <span className="kl-mono" style={{ fontSize: 11, color: "var(--kl-text-faint)" }}>{type}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
    </div>
    </div>
  );
}

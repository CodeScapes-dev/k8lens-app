"use client";

import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

function stateLabel(cs) {
  if (!cs?.state) return "—";
  const key = Object.keys(cs.state)[0];
  return key;
}

function stateTone(cs) {
  const key = Object.keys(cs?.state ?? {})[0];
  if (key === "running") return "ok";
  if (key === "waiting") return "warn";
  if (key === "terminated") return cs.state.terminated?.exitCode === 0 ? "neutral" : "err";
  return "neutral";
}

export function ResourcesTab({ pod }) {
  if (!pod) return null;
  const spec = pod.spec ?? {};
  const status = pod.status ?? {};
  const containerStatuses = status.containerStatuses ?? [];
  const containers = spec.containers ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="Container Resources">
        <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 620 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 100px 100px 70px", gap: "6px 12px", marginBottom: 8 }}>
          {["Container", "State", "CPU Req", "CPU Limit", "Mem Req", "Mem Limit", "Restarts"].map((h) => (
            <span key={h} className="kl-mono" style={{ fontSize: 10, color: "var(--kl-text-faint)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</span>
          ))}
        </div>
        {containers.map((c) => {
          const cs = containerStatuses.find((s) => s.name === c.name);
          const res = c.resources ?? {};
          return (
            <div key={c.name} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 100px 100px 70px", gap: "6px 12px", padding: "10px 0", borderTop: "1px solid var(--kl-border)", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</span>
              <KLBadge tone={stateTone(cs)}>{stateLabel(cs)}</KLBadge>
              <span className="kl-mono" style={{ fontSize: 12 }}>{res.requests?.cpu ?? "—"}</span>
              <span className="kl-mono" style={{ fontSize: 12 }}>{res.limits?.cpu ?? "—"}</span>
              <span className="kl-mono" style={{ fontSize: 12 }}>{res.requests?.memory ?? "—"}</span>
              <span className="kl-mono" style={{ fontSize: 12 }}>{res.limits?.memory ?? "—"}</span>
              <span className="kl-mono" style={{ fontSize: 12 }}>{cs?.restartCount ?? 0}</span>
            </div>
          );
        })}
        </div>
        </div>
      </Panel>

      {containers.map((c) => {
        const envVars = c.env ?? [];
        if (envVars.length === 0) return null;
        return (
          <Panel key={c.name} title={`Environment · ${c.name}`} subtitle={`${envVars.length} variable${envVars.length !== 1 ? "s" : ""}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {envVars.map((e, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, padding: "5px 0", borderBottom: "1px solid var(--kl-border)" }}>
                  <span className="kl-mono" style={{ fontSize: 11.5, color: "var(--kl-text-2)", fontWeight: 500 }}>{e.name}</span>
                  <span className="kl-mono" style={{ fontSize: 11.5, color: "var(--kl-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.value ?? (e.valueFrom ? "<from ref>" : "—")}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

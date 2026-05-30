"use client";

import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function ResourcesTab({ deployment }) {
  if (!deployment) return null;
  const containers = deployment.spec?.template?.spec?.containers ?? [];
  const initContainers = deployment.spec?.template?.spec?.initContainers ?? [];

  function ContainerRow({ c }) {
    const res = c.resources ?? {};
    return (
      <div style={{ padding: "10px 0", borderTop: "1px solid var(--kl-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
          {c.imagePullPolicy && <KLBadge tone="neutral">{c.imagePullPolicy}</KLBadge>}
        </div>
        <div className="kl-mono" style={{ fontSize: 11, color: "var(--kl-text-muted)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.image}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px 16px" }}>
          {[
            { label: "CPU Request",    value: res.requests?.cpu ?? "—" },
            { label: "CPU Limit",      value: res.limits?.cpu ?? "—" },
            { label: "Memory Request", value: res.requests?.memory ?? "—" },
            { label: "Memory Limit",   value: res.limits?.memory ?? "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-faint)", marginBottom: 2 }}>{label}</div>
              <div className="kl-mono" style={{ fontSize: 12.5, color: "var(--kl-text)" }}>{value}</div>
            </div>
          ))}
        </div>
        {c.ports?.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.ports.map((p, i) => (
              <KLBadge key={i} tone="neutral">{p.containerPort}/{p.protocol ?? "TCP"}</KLBadge>
            ))}
          </div>
        )}
        {c.env?.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="kl-mono" style={{ fontSize: 10, color: "var(--kl-text-faint)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Environment ({c.env.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {c.env.map((e, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, padding: "4px 0", borderBottom: "1px solid var(--kl-border)" }}>
                  <span className="kl-mono" style={{ fontSize: 11.5, color: "var(--kl-text-2)", fontWeight: 500 }}>{e.name}</span>
                  <span className="kl-mono" style={{ fontSize: 11.5, color: "var(--kl-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.value ?? (e.valueFrom ? "<from ref>" : "—")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="Containers" subtitle={`${containers.length} container${containers.length !== 1 ? "s" : ""}`}>
        {containers.map((c) => <ContainerRow key={c.name} c={c} />)}
      </Panel>

      {initContainers.length > 0 && (
        <Panel title="Init Containers" subtitle={`${initContainers.length} container${initContainers.length !== 1 ? "s" : ""}`}>
          {initContainers.map((c) => <ContainerRow key={c.name} c={c} />)}
        </Panel>
      )}

      {deployment.spec?.template?.spec?.volumes?.length > 0 && (
        <Panel title="Volumes" subtitle={`${deployment.spec.template.spec.volumes.length} volume${deployment.spec.template.spec.volumes.length !== 1 ? "s" : ""}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {deployment.spec.template.spec.volumes.map((v) => {
              const type = Object.keys(v).find((k) => k !== "name") ?? "unknown";
              return (
                <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--kl-border)" }}>
                  <span style={{ fontSize: 14, color: "var(--kl-text-muted)" }}>◈</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{v.name}</span>
                  <KLBadge tone="neutral">{type}</KLBadge>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

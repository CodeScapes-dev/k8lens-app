"use client";

import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function MetadataTab({ pod }) {
  if (!pod) return null;
  const meta = pod.metadata ?? {};
  const labels = meta.labels ?? {};
  const annotations = meta.annotations ?? {};
  const finalizers = meta.finalizers ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="Labels" subtitle={`${Object.keys(labels).length} label${Object.keys(labels).length !== 1 ? "s" : ""}`}>
        {Object.keys(labels).length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No labels</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(labels).map(([k, v]) => (
              <KLBadge key={k} tone="neutral">{k}={v}</KLBadge>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Annotations" subtitle={`${Object.keys(annotations).length} annotation${Object.keys(annotations).length !== 1 ? "s" : ""}`}>
        {Object.keys(annotations).length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No annotations</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(annotations).map(([k, v]) => (
              <div key={k} style={{ padding: "8px 0", borderBottom: "1px solid var(--kl-border)" }}>
                <span className="kl-mono" style={{ display: "block", fontSize: 11, color: "var(--kl-text-2)", fontWeight: 600, marginBottom: 3, wordBreak: "break-all" }}>{k}</span>
                <span className="kl-mono" style={{ display: "block", fontSize: 11.5, color: "var(--kl-text-muted)", wordBreak: "break-all", whiteSpace: "pre-wrap" }} title={v}>
                  {v.length > 200 ? v.slice(0, 200) + "…" : v}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="System">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(100px, 160px) 1fr", gap: "8px 12px" }}>
          <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>Resource Version</span>
          <span className="kl-mono" style={{ fontSize: 12 }}>{meta.resourceVersion ?? "—"}</span>
          <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>Generation</span>
          <span className="kl-mono" style={{ fontSize: 12 }}>{meta.generation ?? "—"}</span>
          <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>Finalizers</span>
          <span style={{ fontSize: 12 }}>
            {finalizers.length === 0 ? <span style={{ color: "var(--kl-text-faint)" }}>none</span> : finalizers.join(", ")}
          </span>
        </div>
      </Panel>
    </div>
  );
}

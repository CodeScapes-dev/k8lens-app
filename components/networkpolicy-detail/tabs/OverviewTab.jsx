import React from "react";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function OverviewTab({ networkPolicy }) {
  if (!networkPolicy) return null;
  const meta = networkPolicy.metadata ?? {};
  const spec = networkPolicy.spec ?? {};
  const policyTypes = spec.policyTypes ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <Panel title="Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
          {[
            ["Name", meta.name],
            ["Namespace", meta.namespace],
            ["Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—"],
          ].map(([l, v]) => (
            <React.Fragment key={l}>
              <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
              <span className="kl-mono" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
            </React.Fragment>
          ))}
        </div>
      </Panel>
      <div className="flex flex-col gap-4">
        <Panel title="Policy Types">
          <div className="flex flex-wrap gap-2">
            {policyTypes.length === 0
              ? <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>None specified</span>
              : policyTypes.map((t) => <KLBadge key={t} tone="accent">{t}</KLBadge>)}
          </div>
        </Panel>
        <Panel title="Pod Selector">
          <div className="flex flex-wrap gap-2">
            {Object.keys(spec.podSelector?.matchLabels ?? {}).length === 0
              ? <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>All pods in namespace</span>
              : Object.entries(spec.podSelector?.matchLabels ?? {}).map(([k, v]) => <KLBadge key={k} tone="accent">{k}={v}</KLBadge>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}

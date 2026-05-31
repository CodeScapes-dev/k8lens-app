import React from "react";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { KLStatus } from "@/components/kl/Status";

export function OverviewTab({ endpoints }) {
  if (!endpoints) return null;
  const meta = endpoints.metadata ?? {};
  const subsets = endpoints.subsets ?? [];
  const allAddresses = subsets.flatMap((s) => s.addresses ?? []);
  const notReadyAddresses = subsets.flatMap((s) => s.notReadyAddresses ?? []);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
          {[
            ["Name", meta.name],
            ["Namespace", meta.namespace],
            ["Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—"],
            ["Ready", allAddresses.length],
            ["Not Ready", notReadyAddresses.length],
          ].map(([l, v]) => (
            <React.Fragment key={l}>
              <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
              <span className="kl-mono" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
            </React.Fragment>
          ))}
        </div>
      </Panel>

      {subsets.map((subset, si) => (
        <Panel key={si} title={`Subset ${si + 1}`} subtitle={(subset.ports ?? []).map((p) => `${p.name ?? ""} ${p.port}/${p.protocol ?? "TCP"}`).join(", ")}>
          <div className="grid gap-x-3 mb-2" style={{ gridTemplateColumns: "16px 1fr 1fr", fontSize: 10 }}>
            {["", "IP", "Target"].map((h) => (
              <span key={h} className="kl-mono" style={{ color: "var(--kl-text-faint)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</span>
            ))}
          </div>
          {(subset.addresses ?? []).map((addr, ai) => (
            <div key={ai} className="grid gap-x-3 items-center" style={{ gridTemplateColumns: "16px 1fr 1fr", padding: "5px 0", borderTop: "1px solid var(--kl-border)", fontSize: 12 }}>
              <KLStatus kind="ok" dotOnly />
              <span className="kl-mono">{addr.ip}</span>
              <span style={{ color: "var(--kl-text-muted)" }}>{addr.targetRef ? `${addr.targetRef.kind}/${addr.targetRef.name}` : addr.hostname ?? "—"}</span>
            </div>
          ))}
          {(subset.notReadyAddresses ?? []).map((addr, ai) => (
            <div key={`nr-${ai}`} className="grid gap-x-3 items-center" style={{ gridTemplateColumns: "16px 1fr 1fr", padding: "5px 0", borderTop: "1px solid var(--kl-border)", fontSize: 12 }}>
              <KLStatus kind="warn" dotOnly />
              <span className="kl-mono" style={{ color: "var(--kl-text-muted)" }}>{addr.ip}</span>
              <span style={{ color: "var(--kl-text-faint)" }}>not ready</span>
            </div>
          ))}
        </Panel>
      ))}

      {subsets.length === 0 && (
        <Panel title="Endpoints">
          <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No endpoints — service may have no matching pods</span>
        </Panel>
      )}
    </div>
  );
}

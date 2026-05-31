import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";

function pvStatusKind(phase) {
  return phase === "Bound" ? "ok" : phase === "Available" ? "info" : "warn";
}

export function OverviewTab({ sc, pvs, pvcs, workloads }) {
  if (!sc) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <Panel title="Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 180px) 1fr", fontSize: 12 }}>
          {[
            ["Name", sc.metadata?.name],
            ["Provisioner", sc.provisioner],
            ["Reclaim Policy", sc.reclaimPolicy ?? "Delete"],
            ["Volume Binding Mode", sc.volumeBindingMode ?? "Immediate"],
            ["Allow Expansion", sc.allowVolumeExpansion ? "Yes" : "No"],
            ["Created", sc.metadata?.creationTimestamp ? calculateAge(sc.metadata.creationTimestamp) + " ago" : "—"],
          ].map(([l, v]) => (
            <React.Fragment key={l}>
              <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
              <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
            </React.Fragment>
          ))}
        </div>
      </Panel>
      <div className="flex flex-col gap-4">
        <Panel title="Usage">
          <div className="grid grid-cols-3 gap-2">
            {[{ label: "PVs", value: pvs.length }, { label: "PVCs", value: pvcs.length }, { label: "Workloads", value: workloads.length }].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center", padding: "10px 8px", background: "var(--kl-surface-2)", borderRadius: 8, border: "1px solid var(--kl-border)" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
                <div className="kl-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--kl-text)" }}>{value}</div>
              </div>
            ))}
          </div>
        </Panel>
        {sc.parameters && Object.keys(sc.parameters).length > 0 && (
          <Panel title="Parameters">
            <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "1fr 1fr", fontSize: 11 }}>
              {Object.entries(sc.parameters).map(([k, v]) => (
                <React.Fragment key={k}>
                  <span style={{ color: "var(--kl-text-muted)" }}>{k}</span>
                  <span className="kl-mono break-all" style={{ color: "var(--kl-text-2)" }}>{v}</span>
                </React.Fragment>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

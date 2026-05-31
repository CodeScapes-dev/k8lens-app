import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";

function pvcStatusKind(phase) {
  return phase === "Bound" ? "ok" : phase === "Pending" ? "warn" : "err";
}

export function OverviewTab({ pvc, pods }) {
  if (!pvc) return null;
  const phase = pvc.status?.phase ?? "Unknown";
  const spec = pvc.spec ?? {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <div className="flex flex-col gap-4">
        <Panel title="PVC Info">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
            {[
              ["Name", pvc.metadata?.name],
              ["Namespace", pvc.metadata?.namespace],
              ["UID", pvc.metadata?.uid],
              ["Storage Class", spec.storageClassName ?? "—"],
              ["Access Modes", (spec.accessModes ?? []).join(", ")],
              ["Volume Mode", spec.volumeMode ?? "—"],
              ["Volume Name", spec.volumeName ?? "—"],
              ["Capacity", pvc.status?.capacity?.storage ?? "—"],
              ["Created", pvc.metadata?.creationTimestamp ? calculateAge(pvc.metadata.creationTimestamp) + " ago" : "—"],
            ].map(([l, v]) => (
              <React.Fragment key={l}>
                <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
              </React.Fragment>
            ))}
          </div>
        </Panel>
        {pods.length > 0 && (
          <Panel title="Mounted By" subtitle={`${pods.length} pod${pods.length !== 1 ? "s" : ""}`}>
            {pods.map((pod) => {
              const podPhase = pod.status?.phase ?? "Unknown";
              const pkind = podPhase === "Running" ? "ok" : podPhase === "Pending" ? "warn" : "err";
              return (
                <div key={pod.metadata?.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--kl-border)" }}>
                  <KLStatus kind={pkind} dotOnly />
                  <span className="kl-mono break-all" style={{ fontSize: 12, flex: 1 }}>{pod.metadata?.name}</span>
                  <KLBadge tone={pkind}>{podPhase}</KLBadge>
                </div>
              );
            })}
          </Panel>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <Panel title="Status">
          <div className="flex items-center gap-2">
            <KLStatus kind={pvcStatusKind(phase)} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{phase}</span>
          </div>
        </Panel>
        <Panel title="Storage Request">
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <div className="kl-mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--kl-text)" }}>{spec.resources?.requests?.storage ?? "—"}</div>
            <div style={{ fontSize: 11, color: "var(--kl-text-muted)", marginTop: 4 }}>requested</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

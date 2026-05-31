import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";

export function pvStatusKind(phase) {
  return phase === "Bound" ? "ok" : phase === "Available" ? "info" : phase === "Released" ? "warn" : "err";
}

const VOLUME_SOURCE_KEYS = ["capacity", "accessModes", "claimRef", "persistentVolumeReclaimPolicy", "storageClassName", "volumeMode", "nodeAffinity"];

function VolumeSourcePanel({ spec }) {
  const sourceKey = Object.keys(spec).find((k) => !VOLUME_SOURCE_KEYS.includes(k) && typeof spec[k] === "object");
  if (!sourceKey) return null;
  const entries = Object.entries(spec[sourceKey] ?? {});
  if (!entries.length) return null;
  return (
    <Panel title={`Volume Source (${sourceKey})`}>
      <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
        {entries.map(([k, v]) => (
          <React.Fragment key={k}>
            <span style={{ color: "var(--kl-text-muted)" }}>{k}</span>
            <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
          </React.Fragment>
        ))}
      </div>
    </Panel>
  );
}

function NodeAffinityPanel({ nodeAffinity }) {
  const terms = nodeAffinity?.required?.nodeSelectorTerms ?? [];
  if (!terms.length) return null;
  return (
    <Panel title="Node Affinity">
      {terms.map((term, ti) => (
        <div key={ti} style={{ marginBottom: ti < terms.length - 1 ? 12 : 0 }}>
          {(term.matchExpressions ?? []).map((expr, ei) => (
            <div key={ei} className="kl-mono" style={{ fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "var(--kl-text-muted)" }}>{expr.key}</span>
              {" "}<KLBadge tone="neutral">{expr.operator}</KLBadge>{" "}
              <span style={{ color: "var(--kl-text)" }}>{(expr.values ?? []).join(", ")}</span>
            </div>
          ))}
        </div>
      ))}
    </Panel>
  );
}

export function OverviewTab({ pv }) {
  if (!pv) return null;
  const phase = pv.status?.phase ?? "Unknown";
  const spec = pv.spec ?? {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <div className="flex flex-col gap-4">
        <Panel title="PV Info">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
            {[
              ["Name", pv.metadata?.name],
              ["UID", pv.metadata?.uid],
              ["Storage Class", spec.storageClassName ?? "—"],
              ["Reclaim Policy", spec.persistentVolumeReclaimPolicy ?? "—"],
              ["Volume Mode", spec.volumeMode ?? "—"],
              ["Capacity", spec.capacity?.storage ?? "—"],
              ["Access Modes", (spec.accessModes ?? []).join(", ")],
              ["Created", pv.metadata?.creationTimestamp ? calculateAge(pv.metadata.creationTimestamp) + " ago" : "—"],
            ].map(([l, v]) => (
              <React.Fragment key={l}>
                <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
              </React.Fragment>
            ))}
          </div>
        </Panel>
        <VolumeSourcePanel spec={spec} />
        <NodeAffinityPanel nodeAffinity={spec.nodeAffinity} />
      </div>
      <div className="flex flex-col gap-4">
        <Panel title="Status">
          <div className="flex items-center gap-2 mb-2">
            <KLStatus kind={pvStatusKind(phase)} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{phase}</span>
          </div>
          {pv.status?.reason && <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>{pv.status.reason}</div>}
          {pv.status?.message && <div style={{ fontSize: 12, color: "var(--kl-text-2)", marginTop: 4 }}>{pv.status.message}</div>}
        </Panel>
        {spec.claimRef && (
          <Panel title="Bound To">
            <div className="flex gap-2 items-center flex-wrap">
              <KLBadge tone="accent">PVC</KLBadge>
              <span className="kl-mono break-all" style={{ fontSize: 13 }}>{spec.claimRef.namespace}/{spec.claimRef.name}</span>
            </div>
          </Panel>
        )}
        <Panel title="Capacity">
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <div className="kl-mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--kl-text)" }}>{spec.capacity?.storage ?? "—"}</div>
            <div style={{ fontSize: 11, color: "var(--kl-text-muted)", marginTop: 4 }}>total storage</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

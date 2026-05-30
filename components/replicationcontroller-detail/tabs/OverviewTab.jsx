import React from "react";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function OverviewTab({ rc, pods, events }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <Panel title="Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr" }}>
          {[["Name", rc?.metadata?.name], ["Namespace", rc?.metadata?.namespace], ["UID", rc?.metadata?.uid], ["Created", rc?.metadata?.creationTimestamp ? calculateAge(rc.metadata.creationTimestamp) + " ago" : "—"]].map(([label, value]) => (
            <React.Fragment key={label}>
              <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>{label}</span>
              <span className="kl-mono" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value ?? "—"}</span>
            </React.Fragment>
          ))}
        </div>
      </Panel>

      <Panel title="Selector">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(rc?.spec?.selector ?? {}).map(([k, v]) => (
            <KLBadge key={k} tone="accent">{k}={v}</KLBadge>
          ))}
        </div>
      </Panel>
    </div>
  );
}

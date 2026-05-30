import React from "react";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function OverviewTab({ rs, pods, events }) {
  if (!rs) return null;
  const meta = rs.metadata ?? {};
  const spec = rs.spec ?? {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <Panel title="Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr" }}>
          {[["Name", meta.name], ["Namespace", meta.namespace], ["UID", meta.uid], ["Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—"]].map(([label, value]) => (
            <React.Fragment key={label}>
              <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>{label}</span>
              <span className="kl-mono" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value ?? "—"}</span>
            </React.Fragment>
          ))}
        </div>
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title="Selector">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(spec.selector?.matchLabels ?? {}).map(([k, v]) => (
              <KLBadge key={k} tone="accent">{k}={v}</KLBadge>
            ))}
          </div>
        </Panel>

        {(meta.ownerReferences ?? []).length > 0 && (
          <Panel title="Owner References">
            <div className="flex flex-col gap-1.5">
              {(meta.ownerReferences ?? []).map((o) => (
                <div key={o.uid} className="flex items-center gap-2">
                  <KLBadge tone="accent">{o.kind}</KLBadge>
                  <span className="kl-mono" style={{ fontSize: 12 }}>{o.name}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

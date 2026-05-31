import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";

function ConditionsPanel({ conditions }) {
  if (!conditions?.length) return null;
  return (
    <Panel title="Conditions" subtitle={`${conditions.length} condition${conditions.length !== 1 ? "s" : ""}`}>
      <div className="flex flex-col">
        {conditions.map((c) => (
          <div key={c.type} className="grid gap-x-3 py-2.5" style={{ gridTemplateColumns: "120px 52px 1fr", borderTop: "1px solid var(--kl-border)", fontSize: 12, alignItems: "start" }}>
            <span className="kl-mono font-medium">{c.type}</span>
            <KLBadge tone={c.status === "True" ? (c.type === "Ready" ? "ok" : "err") : "ok"}>{c.status}</KLBadge>
            <span style={{ color: "var(--kl-text-muted)" }}>{c.message ?? "—"}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function OverviewTab({ node, pods }) {
  if (!node) return null;
  const conditions = node.status?.conditions ?? [];
  const info = node.status?.nodeInfo ?? {};
  const capacity = node.status?.capacity ?? {};
  const allocatable = node.status?.allocatable ?? {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <div className="flex flex-col gap-4">
        <Panel title="System Info">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
            {[["OS Image", info.osImage], ["Kernel", info.kernelVersion], ["Container Runtime", info.containerRuntimeVersion], ["Kube Proxy", info.kubeProxyVersion]].map(([l, v]) => (
              <React.Fragment key={l}>
                <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                <span className="kl-mono break-all">{v ?? "—"}</span>
              </React.Fragment>
            ))}
          </div>
        </Panel>
        <ConditionsPanel conditions={conditions} />
      </div>
      <div className="flex flex-col gap-4">
        <Panel title="Capacity">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
            {[["CPU (capacity)", capacity.cpu], ["CPU (allocatable)", allocatable.cpu], ["Memory (capacity)", capacity.memory], ["Memory (allocatable)", allocatable.memory], ["Max Pods", capacity.pods]].map(([l, v]) => (
              <React.Fragment key={l}>
                <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                <span className="kl-mono break-all">{v ?? "—"}</span>
              </React.Fragment>
            ))}
          </div>
        </Panel>
        {pods.length > 0 && (
          <Panel title="Recent Pods" subtitle={`${pods.length} total`}>
            {pods.slice(0, 5).map((pod) => {
              const phase = pod?.status?.phase ?? "Unknown";
              const pkind = phase === "Running" ? "ok" : phase === "Pending" ? "warn" : "err";
              return (
                <div key={pod?.metadata?.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid var(--kl-border)" }}>
                  <KLStatus kind={pkind} dotOnly />
                  <span className="kl-mono break-all" style={{ fontSize: 12, flex: 1 }}>{pod?.metadata?.name}</span>
                  <KLBadge tone="neutral">{pod?.metadata?.namespace}</KLBadge>
                  <KLBadge tone={pkind}>{phase}</KLBadge>
                </div>
              );
            })}
            {pods.length > 5 && <div style={{ fontSize: 11, color: "var(--kl-text-muted)", paddingTop: 4 }}>+{pods.length - 5} more · see Pods tab</div>}
          </Panel>
        )}
      </div>
    </div>
  );
}

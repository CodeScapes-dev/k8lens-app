import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";

export function OverviewTab({ ns, pods, deployments, services, configMaps, secrets, daemonSets, statefulSets, jobs, cronJobs, ingresses, quotas, limits }) {
  if (!ns) return null;
  const phase = ns.status?.phase ?? "Unknown";
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4 items-start">
      <Panel title="Namespace Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(80px, 120px) 1fr", fontSize: 12 }}>
          {[["Name", ns.metadata?.name], ["UID", ns.metadata?.uid], ["Created", ns.metadata?.creationTimestamp ? calculateAge(ns.metadata.creationTimestamp) + " ago" : "—"], ["Phase", phase]].map(([l, v]) => (
            <React.Fragment key={l}>
              <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
              <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
            </React.Fragment>
          ))}
        </div>
      </Panel>
      <div className="grid grid-cols-3 gap-2">
        {[["Pods", pods.length], ["Deployments", deployments.length], ["Services", services.length], ["ConfigMaps", configMaps.length], ["Secrets", secrets.length], ["Ingresses", ingresses.length], ["StatefulSets", statefulSets.length], ["DaemonSets", daemonSets.length], ["Jobs", jobs.length + cronJobs.length]].map(([l, v]) => (
          <div key={l} style={{ padding: "8px 10px", background: "var(--kl-surface-2)", borderRadius: 8, border: "1px solid var(--kl-border)", textAlign: "center" }}>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--kl-text-muted)", marginBottom: 3 }}>{l}</div>
            <div className="kl-mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--kl-text)" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

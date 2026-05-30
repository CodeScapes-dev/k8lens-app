import React from "react";
import { calculateAge, formatTimestamp } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function jobStatusKind(job) {
  const conds = job?.status?.conditions ?? [];
  if (conds.find((c) => c.type === "Complete" && c.status === "True")) return "ok";
  if (conds.find((c) => c.type === "Failed" && c.status === "True")) return "err";
  return "warn";
}

export function statusColor(job) {
  const k = jobStatusKind(job);
  return k === "ok" ? "bg-green-500" : k === "err" ? "bg-destructive" : "bg-yellow-500";
}

export function OverviewTab({ job, pods }) {
  if (!job) return null;
  const meta = job.metadata ?? {};
  const spec = job.spec ?? {};
  const status = job.status ?? {};

  const startTime = status.startTime;
  const completionTime = status.completionTime;
  let duration = "—";
  if (startTime) {
    const end = completionTime ? new Date(completionTime) : new Date();
    const diff = Math.floor((end - new Date(startTime)) / 1000);
    duration = diff < 60 ? `${diff}s` : diff < 3600 ? `${Math.floor(diff / 60)}m ${diff % 60}s` : `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <div className="flex flex-col gap-4">
        <Panel title="Job Info">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr" }}>
            {[
              ["Name", meta.name], ["Namespace", meta.namespace], ["UID", meta.uid],
              ["Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—"],
              ["Parallelism", spec.parallelism ?? 1], ["Completions", spec.completions ?? 1],
              ["Backoff Limit", spec.backoffLimit ?? "—"],
              ["Started", startTime ? formatTimestamp(startTime) : "—"],
              ["Completed", completionTime ? formatTimestamp(completionTime) : "—"],
              ["Duration", duration],
            ].map(([label, value]) => (
              <React.Fragment key={label}>
                <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>{label}</span>
                <span className="kl-mono" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value ?? "—"}</span>
              </React.Fragment>
            ))}
          </div>
        </Panel>

      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Execution">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Succeeded", value: status.succeeded ?? 0, kind: "ok" },
              { label: "Failed",    value: status.failed ?? 0,    kind: "err" },
              { label: "Active",    value: status.active ?? 0,    kind: "warn" },
              { label: "Ready",     value: status.ready ?? 0,     kind: "neutral" },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: "10px 8px", background: "var(--kl-surface-2)", borderRadius: 8, border: "1px solid var(--kl-border)", textAlign: "center" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
                <div className="kl-mono" style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
              </div>
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

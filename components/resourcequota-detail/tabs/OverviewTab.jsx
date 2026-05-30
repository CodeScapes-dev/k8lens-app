import React from "react";
import { CpuIcon, MemoryStickIcon, ServerIcon, HardDriveIcon } from "lucide-react";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";

function parseVal(v, type) {
  if (!v) return 0;
  if (type === "cpu") {
    if (v.endsWith("m")) return parseFloat(v) / 1000;
    return parseFloat(v) || 0;
  }
  if (type === "memory") {
    if (v.endsWith("Ki")) return parseFloat(v) * 1024;
    if (v.endsWith("Mi")) return parseFloat(v) * 1024 ** 2;
    if (v.endsWith("Gi")) return parseFloat(v) * 1024 ** 3;
    return parseFloat(v) || 0;
  }
  return parseInt(v) || 0;
}

function resourceType(key) {
  if (key.includes("cpu")) return "cpu";
  if (key.includes("memory") || key.includes("storage")) return "memory";
  return "count";
}

function ResourceItem({ resource, used, hard }) {
  const type = resourceType(resource);
  const u = parseVal(used, type);
  const h = parseVal(hard, type);
  const pct = h > 0 ? Math.min(100, Math.round((u / h) * 100)) : 0;
  const barColor = pct > 80 ? "var(--kl-err)" : pct > 50 ? "var(--kl-warn)" : "var(--kl-ok)";

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="kl-mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--kl-text)", marginBottom: 3 }}>{resource}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span className="kl-mono" style={{ fontSize: 10.5, color: "var(--kl-text-muted)", whiteSpace: "nowrap" }}>{used ?? "0"} / {hard}</span>
        <span className="kl-mono" style={{ fontSize: 10.5, fontWeight: 700, color: barColor, whiteSpace: "nowrap", marginLeft: "auto" }}>{h > 0 ? `${pct}%` : "—"}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--kl-surface-3)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

export function OverviewTab({ resourceQuota }) {
  if (!resourceQuota) return null;
  const meta = resourceQuota.metadata ?? {};
  const hard = resourceQuota.spec?.hard ?? {};
  const used = resourceQuota.status?.used ?? {};

  const cpuRes = Object.keys(hard).filter((k) => k.includes("cpu"));
  const memRes = Object.keys(hard).filter((k) => k.includes("memory"));
  const storageRes = Object.keys(hard).filter((k) => k.includes("storage") && !k.includes("memory"));
  const countRes = Object.keys(hard).filter((k) => !k.includes("cpu") && !k.includes("memory") && !k.includes("storage"));

  const groups = [
    { title: "CPU", icon: CpuIcon, resources: cpuRes },
    { title: "Memory", icon: MemoryStickIcon, resources: memRes },
    { title: "Count", icon: ServerIcon, resources: countRes },
    { title: "Storage", icon: HardDriveIcon, resources: storageRes },
  ].filter((g) => g.resources.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
          {[["Name", meta.name], ["Namespace", meta.namespace], ["UID", meta.uid], ["Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—"]].map(([l, v]) => (
            <React.Fragment key={l}>
              <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
              <span className="kl-mono" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
            </React.Fragment>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {groups.map((g) => (
          <Panel key={g.title} title={g.title} subtitle={`${g.resources.length} constraint${g.resources.length !== 1 ? "s" : ""}`}>
            {g.resources.map((res) => (
              <ResourceItem key={res} resource={res} used={used[res]} hard={hard[res]} />
            ))}
          </Panel>
        ))}
      </div>
    </div>
  );
}

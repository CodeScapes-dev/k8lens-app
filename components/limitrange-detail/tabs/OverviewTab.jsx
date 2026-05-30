import React from "react";
import { CpuIcon, MemoryStickIcon } from "lucide-react";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";

function parseRes(v, type) {
  if (!v || v === "0") return 0;
  if (type === "cpu") {
    if (v.endsWith("m")) return parseFloat(v) / 1000;
    return parseFloat(v) || 0;
  }
  if (v.endsWith("Ki")) return parseFloat(v) * 1024;
  if (v.endsWith("Mi")) return parseFloat(v) * 1024 ** 2;
  if (v.endsWith("Gi")) return parseFloat(v) * 1024 ** 3;
  return parseFloat(v) || 0;
}

function RangeBar({ min, defaultRequest, defaultLimit, max, type }) {
  const maxVal = parseRes(max, type);
  if (maxVal === 0) return null;

  const pct = (v) => Math.min(100, Math.round((parseRes(v, type) / maxVal) * 100));
  const minPct = pct(min);
  const reqPct = pct(defaultRequest);
  const limPct = pct(defaultLimit);

  return (
    <div>
      <div className="flex justify-between mb-1.5" style={{ fontSize: 10 }}>
        {[["Min", min], ["Def. Request", defaultRequest], ["Def. Limit", defaultLimit], ["Max", max]].map(([label, val]) => (
          val ? <span key={label} className="kl-mono" style={{ color: "var(--kl-text-muted)" }}>{label}: <span style={{ color: "var(--kl-text-2)" }}>{val}</span></span> : null
        ))}
      </div>
      <div className="relative rounded-md overflow-hidden" style={{ height: 12, background: "var(--kl-surface-3)" }}>
        {minPct > 0 && <div className="absolute top-0 bottom-0" style={{ left: 0, width: `${minPct}%`, background: "rgba(249,115,22,0.35)" }} />}
        {reqPct > 0 && <div className="absolute top-0 bottom-0" style={{ left: 0, width: `${reqPct}%`, background: "rgba(59,130,246,0.5)" }} />}
        {limPct > 0 && <div className="absolute top-0 bottom-0" style={{ left: 0, width: `${limPct}%`, background: "rgba(34,197,94,0.5)" }} />}
        {minPct > 0 && <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${minPct}%`, background: "rgb(234,88,12)" }} />}
        {reqPct > 0 && <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${reqPct}%`, background: "rgb(37,99,235)" }} />}
        {limPct > 0 && <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${limPct}%`, background: "rgb(22,163,74)" }} />}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {[["rgb(249,115,22)", "Min"], ["rgb(59,130,246)", "Def. Request"], ["rgb(34,197,94)", "Def. Limit"]].map(([bg, label]) => (
          <div key={label} className="flex items-center gap-1" style={{ fontSize: 10, color: "var(--kl-text-muted)" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: bg }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--kl-border)", background: "var(--kl-surface-2)", minWidth: 120 }}>
      <div className="kl-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
      <div className="kl-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--kl-text)" }}>{value}</div>
    </div>
  );
}

function ContainerLimitPanel({ limit }) {
  const hasCpu = limit.min?.cpu || limit.max?.cpu || limit.default?.cpu || limit.defaultRequest?.cpu;
  const hasMem = limit.min?.memory || limit.max?.memory || limit.default?.memory || limit.defaultRequest?.memory;
  if (!hasCpu && !hasMem) return null;
  return (
    <Panel title="Container Limits">
      <div className="flex flex-col gap-6">
        {hasCpu && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <CpuIcon size={12} style={{ color: "var(--kl-text-muted)" }} />
              <span className="kl-mono" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)" }}>CPU</span>
            </div>
            <RangeBar type="cpu" min={limit.min?.cpu} defaultRequest={limit.defaultRequest?.cpu} defaultLimit={limit.default?.cpu} max={limit.max?.cpu} />
          </div>
        )}
        {hasMem && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <MemoryStickIcon size={12} style={{ color: "var(--kl-text-muted)" }} />
              <span className="kl-mono" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)" }}>Memory</span>
            </div>
            <RangeBar type="memory" min={limit.min?.memory} defaultRequest={limit.defaultRequest?.memory} defaultLimit={limit.default?.memory} max={limit.max?.memory} />
          </div>
        )}
      </div>
    </Panel>
  );
}

function PodLimitPanel({ limit }) {
  const entries = [
    ["Minimum CPU", limit.min?.cpu], ["Maximum CPU", limit.max?.cpu],
    ["Minimum Memory", limit.min?.memory], ["Maximum Memory", limit.max?.memory],
  ].filter(([, v]) => v);
  if (entries.length === 0) return null;
  return (
    <Panel title="Pod Limits" subtitle="Resource constraints per pod">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {entries.map(([label, value]) => <StatBox key={label} label={label} value={value} />)}
      </div>
    </Panel>
  );
}

function PVCLimitPanel({ limit }) {
  const entries = [
    ["Minimum Storage", limit.min?.storage], ["Maximum Storage", limit.max?.storage],
  ].filter(([, v]) => v);
  if (entries.length === 0) return null;
  return (
    <Panel title="PersistentVolumeClaim Limits" subtitle="Storage resource constraints">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {entries.map(([label, value]) => <StatBox key={label} label={label} value={value} />)}
      </div>
    </Panel>
  );
}

function GenericLimitPanel({ limit }) {
  return (
    <Panel title={`${limit.type} Limits`}>
      <div className="grid grid-cols-2 gap-3">
        {[["Min", limit.min], ["Max", limit.max], ["Default", limit.default], ["Def. Request", limit.defaultRequest]].map(([label, obj]) =>
          obj ? Object.entries(obj).map(([res, val]) => (
            <StatBox key={`${label}-${res}`} label={`${label} ${res}`} value={val} />
          )) : null
        )}
      </div>
    </Panel>
  );
}

export function OverviewTab({ limitRange }) {
  if (!limitRange) return null;
  const meta = limitRange.metadata ?? {};
  const limits = limitRange.spec?.limits ?? [];
  const containerLimit = limits.find((l) => l.type === "Container");
  const podLimit = limits.find((l) => l.type === "Pod");
  const pvcLimit = limits.find((l) => l.type === "PersistentVolumeClaim");
  const others = limits.filter((l) => !["Container", "Pod", "PersistentVolumeClaim"].includes(l.type));

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {containerLimit && <ContainerLimitPanel limit={containerLimit} />}
        {podLimit && <PodLimitPanel limit={podLimit} />}
        {pvcLimit && <PVCLimitPanel limit={pvcLimit} />}
      </div>

      {others.map((l, i) => <GenericLimitPanel key={i} limit={l} />)}
    </div>
  );
}

"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, CpuIcon, ShieldAlertIcon, BellIcon, TagIcon, ShareIcon } from "lucide-react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { BlastRadiusContent } from "@/components/blast-radius/BlastRadiusContent";
import { HealthBadge } from "@/components/health-score/HealthBadge";
import { Recommendations } from "@/components/recommendations/Recommendations";
import { CostCard } from "@/components/cost-estimation/CostCard";
import { DependencyGraph } from "@/components/dependency-graph/DependencyGraph";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Resources", icon: CpuIcon },
  { id: "Blast Radius", icon: ShieldAlertIcon },
  { id: "Dependencies", icon: ShareIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

function statusColor(desired, ready) {
  if (desired === 0 || ready === desired) return "bg-green-500";
  if (ready === 0) return "bg-destructive";
  return "bg-yellow-500";
}

function QuickStat({ label, value }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">{label}</span>
      <span className="font-mono text-sm font-bold leading-none">{value}</span>
    </div>
  );
}

export default function StatefulSetDetailPage() {
  const { namespace, name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("statefulset", namespace, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const ss = data?.statefulSet ?? null;
  const pods = data?.pods ?? [];
  const events = data?.events ?? [];

  const desired = ss?.spec?.replicas ?? 0;
  const ready = ss?.status?.readyReplicas ?? 0;
  const labels = ss?.metadata?.labels ?? {};
  const containers = ss?.spec?.template?.spec?.containers ?? [];

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 pt-20 px-4">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={refresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer border-none">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:sticky sm:top-0 sm:z-10 bg-background border-b border-border px-4 sm:px-7 pt-4">
        {loading ? (
          <div className="space-y-3 pb-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-5 w-full max-w-sm" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {ss && <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor(desired, ready)}`} />}
                  <span className="font-mono text-xs text-muted-foreground">StatefulSet · apps/v1 · {namespace}</span>
                  {ss && <HealthBadge resourceType="statefulset" data={data} />}
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(labels).slice(0, 6).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="font-mono text-[10.5px] font-normal">{k}={v}</Badge>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-3 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[240px] sm:min-w-0">
                  <QuickStat label="Ready" value={`${ready}/${desired}`} />
                  <QuickStat label="Age" value={ss?.metadata?.creationTimestamp ? calculateAge(ss.metadata.creationTimestamp) : "—"} />
                  <QuickStat label="Pods" value={pods.length} />
                </div>
              </div>
            </div>
            <div className="flex" style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
              <div className="flex gap-0 min-w-max">
                {TABS.map(({ id, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button key={id} onClick={() => setActiveTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: active ? "2px solid var(--foreground)" : "2px solid transparent", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--foreground)" : "var(--muted-foreground)", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
                      <Icon size={13} />{id}
                      {id === "Events" && events.length > 0 && <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{events.length}</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {ss && <Recommendations resourceType="statefulset" data={data} namespace={namespace} name={name} />}

      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && (
          <div className="flex flex-col gap-4">
            <CostCard containers={containers} replicas={desired} />
            <Panel title="Status">
              <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(120px, 160px) 1fr", fontSize: 12 }}>
                <span style={{ color: "var(--kl-text-muted)" }}>Ready Replicas</span><span className="kl-mono">{ss?.status?.readyReplicas ?? 0}</span>
                <span style={{ color: "var(--kl-text-muted)" }}>Current Replicas</span><span className="kl-mono">{ss?.status?.currentReplicas ?? 0}</span>
                <span style={{ color: "var(--kl-text-muted)" }}>Updated Replicas</span><span className="kl-mono">{ss?.status?.updatedReplicas ?? 0}</span>
                <span style={{ color: "var(--kl-text-muted)" }}>Service Name</span><span className="kl-mono">{ss?.spec?.serviceName ?? "—"}</span>
              </div>
            </Panel>
          </div>
        )}
        {activeTab === "Resources" && (
          <Panel title="Containers">
            <div className="flex flex-col gap-3">
              {containers.map((c) => (
                <div key={c.name} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--kl-border)", background: "var(--kl-surface-2)" }}>
                  <div className="kl-mono font-semibold mb-1.5">{c.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--kl-text-muted)" }}>{c.image}</div>
                  <div className="flex flex-wrap gap-3 mt-2" style={{ fontSize: 11 }}>
                    <span>CPU: {c.resources?.requests?.cpu ?? "—"} / {c.resources?.limits?.cpu ?? "—"}</span>
                    <span>Mem: {c.resources?.requests?.memory ?? "—"} / {c.resources?.limits?.memory ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {activeTab === "Blast Radius" && <BlastRadiusContent resourceType="statefulset" resource={{ ...ss, pods }} namespace={namespace} />}
        {activeTab === "Dependencies" && <DependencyGraph resourceType="statefulset" resource={ss} />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={ss} />}
      </div>
    </div>
  );
}

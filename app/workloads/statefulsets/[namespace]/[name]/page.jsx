"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, CpuIcon, ShieldAlertIcon, BellIcon, TagIcon, ShareIcon } from "lucide-react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge } from "@/lib/k8s/utils";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { BlastRadiusContent } from "@/components/blast-radius/BlastRadiusContent";
import { HealthBadge } from "@/components/health-score/HealthBadge";
import { Recommendations } from "@/components/recommendations/Recommendations";
import { DependencyGraph } from "@/components/dependency-graph/DependencyGraph";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewTab } from "@/components/statefulset-detail/tabs/OverviewTab";
import { ResourcesTab } from "@/components/statefulset-detail/tabs/ResourcesTab";
import { QuickStat, replicaStatusColor } from "@/components/workload-detail/helpers";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Resources", icon: CpuIcon },
  { id: "Blast Radius", icon: ShieldAlertIcon },
  { id: "Dependencies", icon: ShareIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

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
                  {ss && <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${replicaStatusColor(desired, ready)}`} />}
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
        {activeTab === "Overview" && <OverviewTab sts={ss} pods={pods} events={events} />}
        {activeTab === "Resources" && <ResourcesTab containers={containers} />}
        {activeTab === "Blast Radius" && <BlastRadiusContent resourceType="statefulset" resource={{ ...ss, pods }} namespace={namespace} />}
        {activeTab === "Dependencies" && <DependencyGraph resourceType="statefulset" resource={ss} />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={ss} />}
      </div>
    </div>
  );
}

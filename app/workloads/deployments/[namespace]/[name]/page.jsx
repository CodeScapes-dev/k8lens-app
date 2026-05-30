"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  LayoutDashboardIcon, CpuIcon, GitBranchIcon,
  ShieldAlertIcon, BellIcon, TagIcon, ShareIcon,
} from "lucide-react";
import { DependencyGraph } from "@/components/dependency-graph/DependencyGraph";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge } from "@/lib/k8s/utils";
import { HealthBadge } from "@/components/health-score/HealthBadge";
import { Recommendations } from "@/components/recommendations/Recommendations";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewTab }       from "@/components/deployment-detail/tabs/OverviewTab";
import { ResourcesTab }      from "@/components/deployment-detail/tabs/ResourcesTab";
import { RolloutHistoryTab } from "@/components/deployment-detail/tabs/RolloutHistoryTab";
import { BlastRadiusTab }    from "@/components/deployment-detail/tabs/BlastRadiusTab";
import { EventsTab }         from "@/components/deployment-detail/tabs/EventsTab";
import { MetadataTab }       from "@/components/deployment-detail/tabs/MetadataTab";

const TABS = [
  { id: "Overview",        icon: LayoutDashboardIcon },
  { id: "Resources",       icon: CpuIcon },
  { id: "Rollout History", icon: GitBranchIcon },
  { id: "Blast Radius",    icon: ShieldAlertIcon },
  { id: "Dependencies",    icon: ShareIcon },
  { id: "Events",          icon: BellIcon },
  { id: "Metadata",        icon: TagIcon },
];

function statusColor(dep) {
  const desired = dep?.spec?.replicas ?? 0;
  const ready   = dep?.status?.readyReplicas ?? 0;
  const updated = dep?.status?.updatedReplicas ?? 0;
  if (desired === 0 || (ready === desired && updated === desired)) return "bg-green-500";
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

export default function DeploymentDetailPage() {
  const { namespace, name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("deployment", namespace, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const deployment  = data?.deployment  ?? null;
  const replicaSets = data?.replicaSets ?? [];
  const pods        = data?.pods        ?? [];
  const events      = data?.events      ?? [];

  const desired   = deployment?.spec?.replicas ?? 0;
  const ready     = deployment?.status?.readyReplicas ?? 0;
  const updated   = deployment?.status?.updatedReplicas ?? 0;
  const labels    = deployment?.metadata?.labels ?? {};
  const owners    = deployment?.metadata?.ownerReferences ?? [];
  const strategy  = deployment?.spec?.strategy?.type ?? "—";
  const revision  = deployment?.metadata?.annotations?.["deployment.kubernetes.io/revision"];

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 pt-20 px-4">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer border-none"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Sticky header */}
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
              {/* Identity */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {deployment && (
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor(deployment)}`} />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">Deployment · apps/v1 · {namespace}</span>
                  {deployment && <HealthBadge resourceType="deployment" data={data} />}
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(labels).slice(0, 6).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="font-mono text-[10.5px] font-normal">{k}={v}</Badge>
                  ))}
                  {owners.map((o) => (
                    <Badge key={o.uid} variant="outline" className="font-mono text-[10.5px] border-primary/40 bg-primary/10 text-primary">{o.kind}: {o.name}</Badge>
                  ))}
                </div>
              </div>

              {/* Quick stats — scrollable on mobile */}
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-5 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[360px] sm:min-w-0">
                  <QuickStat label="Ready"    value={`${ready}/${desired}`} />
                  <QuickStat label="Updated"  value={updated} />
                  <QuickStat label="Age"      value={deployment?.metadata?.creationTimestamp ? calculateAge(deployment.metadata.creationTimestamp) : "—"} />
                  <QuickStat label="Strategy" value={strategy} />
                  <QuickStat label="Revision" value={revision ? `#${revision}` : "—"} />
                </div>
              </div>
            </div>

            {/* Tabs — horizontally scrollable */}
            <div className="flex" style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
              <div className="flex gap-0 min-w-max">
                {TABS.map(({ id, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
                        background: "none", border: "none",
                        borderBottom: active ? "2px solid var(--foreground)" : "2px solid transparent",
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        color: active ? "var(--foreground)" : "var(--muted-foreground)",
                        cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap",
                      }}
                    >
                      <Icon size={13} />
                      {id}
                      {id === "Events" && events.length > 0 && (
                        <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{events.length}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {deployment && <Recommendations resourceType="deployment" data={data} namespace={namespace} name={name} />}

      {/* Tab content */}
      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview"        && <OverviewTab       deployment={deployment} replicaSets={replicaSets} pods={pods} events={events} onTabChange={setActiveTab} />}
        {activeTab === "Resources"       && <ResourcesTab      deployment={deployment} />}
        {activeTab === "Rollout History" && <RolloutHistoryTab deployment={deployment} replicaSets={replicaSets} />}
        {activeTab === "Blast Radius"    && <BlastRadiusTab    deployment={deployment} pods={pods} replicaSets={replicaSets} />}
        {activeTab === "Dependencies"    && <DependencyGraph   resourceType="deployment" resource={deployment} />}
        {activeTab === "Events"          && <EventsTab         events={events} />}
        {activeTab === "Metadata"        && <MetadataTab       deployment={deployment} />}
      </div>
    </div>
  );
}

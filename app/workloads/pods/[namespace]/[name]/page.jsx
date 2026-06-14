"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  LayoutDashboardIcon, NetworkIcon, CpuIcon, ScrollTextIcon,
  BellIcon, TagIcon, ShareIcon, ActivityIcon,
} from "lucide-react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge, getPodStatus, getPodRestarts, parseK8sResourceValue, formatMemory } from "@/lib/k8s/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthBadge } from "@/components/health-score/HealthBadge";
import { OverviewTab } from "@/components/pod-detail/tabs/OverviewTab";
import { NetworkingTab } from "@/components/pod-detail/tabs/NetworkingTab";
import { ResourcesTab } from "@/components/pod-detail/tabs/ResourcesTab";
import { SharedLogsTab } from "@/components/shared-detail-tabs/LogsTab";
import { EventsTab } from "@/components/pod-detail/tabs/EventsTab";
import { MetadataTab } from "@/components/pod-detail/tabs/MetadataTab";
import { DependencyGraph } from "@/components/dependency-graph/DependencyGraph";
import { PodMetricsTab } from "@/components/pod-detail/tabs/MetricsTab";
import { QuickStat } from "@/components/detail/helpers";

const TABS = [
  { id: "Overview",     icon: LayoutDashboardIcon },
  { id: "Metrics",      icon: ActivityIcon },
  { id: "Networking",   icon: NetworkIcon },
  { id: "Resources",    icon: CpuIcon },
  { id: "Logs",         icon: ScrollTextIcon, live: true },
  { id: "Dependencies", icon: ShareIcon },
  { id: "Events",       icon: BellIcon },
  { id: "Metadata",     icon: TagIcon },
];

function statusColor(s) {
  if (s === "Running" || s === "Succeeded" || s === "Completed") return "bg-green-500";
  if (s === "Pending" || s === "ContainerCreating") return "bg-yellow-500";
  return "bg-destructive";
}

function totalCPU(pod) {
  return (pod?.spec?.containers ?? []).reduce((sum, c) => {
    return sum + parseK8sResourceValue(c.resources?.requests?.cpu, "cpu");
  }, 0);
}

function totalMem(pod) {
  const bytes = (pod?.spec?.containers ?? []).reduce((sum, c) => {
    return sum + parseK8sResourceValue(c.resources?.requests?.memory, "memory");
  }, 0);
  return formatMemory(bytes);
}

export default function PodDetailPage() {
  const { namespace, name } = useParams();
  const { data, loading } = useK8sDetail("pod", namespace, name);

  const [activeTab, setActiveTab] = React.useState("Overview");

  const pod = data?.pod ?? null;
  const events = data?.events ?? [];
  const podStatus = pod ? getPodStatus(pod) : null;
  const restarts = pod ? getPodRestarts(pod) : 0;
  const labels = pod?.metadata?.labels ?? {};
  const owners = pod?.metadata?.ownerReferences ?? [];
  const cpuVal = pod ? totalCPU(pod) : 0;
  const cpuFmt = cpuVal > 0 ? (cpuVal < 1 ? `${Math.round(cpuVal * 1000)}m` : `${cpuVal.toFixed(2)}`) : "—";

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
                  {podStatus && (
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor(podStatus)}`} />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">Pod · v1 · {namespace}</span>
                  {pod && <HealthBadge resourceType="pod" data={data} />}
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(labels).slice(0, 8).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="font-mono text-[10.5px] font-normal">{k}={v}</Badge>
                  ))}
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-4 w-full sm:w-auto rounded-xl border border-border overflow-hidden shrink-0 divide-x divide-border">
                <QuickStat label="Restarts" value={restarts} />
                <QuickStat label="Age" value={pod?.metadata?.creationTimestamp ? calculateAge(pod.metadata.creationTimestamp) : "—"} />
                <QuickStat label="CPU Req" value={cpuFmt} />
                <QuickStat label="Mem Req" value={pod ? totalMem(pod) : "—"} />
              </div>
            </div>

            {/* Tabs — sticky on mobile, scrollable */}
            <div className="flex" style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
              <div className="flex gap-0 min-w-max">
                {TABS.map(({ id, icon: Icon, live }) => {
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
                      {live && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 inline-block" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tab content */}
      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview"     && <OverviewTab pod={pod} events={events} onTabChange={setActiveTab} />}
        {activeTab === "Metrics"      && <PodMetricsTab pod={pod} namespace={namespace} name={name} />}
        {activeTab === "Networking"   && <NetworkingTab pod={pod} />}
        {activeTab === "Resources"    && <ResourcesTab pod={pod} />}
        {activeTab === "Logs"         && <SharedLogsTab pods={pod ? [pod] : []} />}
        {activeTab === "Dependencies" && <DependencyGraph resourceType="pod" resource={pod} />}
        {activeTab === "Events"       && <EventsTab events={events} />}
        {activeTab === "Metadata"     && <MetadataTab pod={pod} />}
      </div>
    </div>
  );
}

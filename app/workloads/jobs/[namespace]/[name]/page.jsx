"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, CpuIcon, BellIcon, TagIcon, ShareIcon, ActivityIcon, ScrollTextIcon } from "lucide-react";
import { DependencyGraph } from "@/components/dependency-graph/DependencyGraph";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge } from "@/lib/k8s/utils";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewTab, jobStatusKind, statusColor } from "@/components/job-detail/tabs/OverviewTab";
import { ResourcesTab } from "@/components/job-detail/tabs/ResourcesTab";
import { QuickStat } from "@/components/workload-detail/helpers";
import { WorkloadMetricsTab } from "@/components/workload-detail/tabs/MetricsTab";
import { SharedLogsTab } from "@/components/shared-detail-tabs/LogsTab";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Metrics", icon: ActivityIcon },
  { id: "Resources", icon: CpuIcon },
  { id: "Logs", icon: ScrollTextIcon, live: true },
  { id: "Dependencies", icon: ShareIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

function jobStatusLabel(job) {
  const k = jobStatusKind(job);
  return k === "ok" ? "Complete" : k === "err" ? "Failed" : "Running";
}

export default function JobDetailPage() {
  const { namespace, name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("job", namespace, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const job = data?.job ?? null;
  const pods = data?.pods ?? [];
  const events = data?.events ?? [];
  const containers = job?.spec?.template?.spec?.containers ?? [];

  const labels = job?.metadata?.labels ?? {};

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
                  {job && <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor(job)}`} />}
                  <span className="font-mono text-xs text-muted-foreground">Job · batch/v1 · {namespace}</span>
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(labels).slice(0, 6).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="font-mono text-[10.5px] font-normal break-all">{k}={v}</Badge>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-3 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[240px] sm:min-w-0">
                  <QuickStat label="Status" value={job ? jobStatusLabel(job) : "—"} />
                  <QuickStat label="Succeeded" value={job?.status?.succeeded ?? 0} />
                  <QuickStat label="Age" value={job?.metadata?.creationTimestamp ? calculateAge(job.metadata.creationTimestamp) : "—"} />
                </div>
              </div>
            </div>
            <div className="flex" style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
              <div className="flex gap-0 min-w-max">
                {TABS.map(({ id, icon: Icon, live }) => {
                  const active = activeTab === id;
                  return (
                    <button key={id} onClick={() => setActiveTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: active ? "2px solid var(--foreground)" : "2px solid transparent", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--foreground)" : "var(--muted-foreground)", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
                      <Icon size={13} />{id}
                      {id === "Events" && events.length > 0 && <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{events.length}</Badge>}
                      {live && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 inline-block" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && <OverviewTab job={job} pods={pods} />}
        {activeTab === "Resources" && <ResourcesTab containers={containers} pods={pods} />}
        {activeTab === "Logs" && <SharedLogsTab pods={pods} />}
        {activeTab === "Dependencies" && <DependencyGraph resourceType="job" resource={job} />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={job} />}
        {activeTab === "Metrics" && <WorkloadMetricsTab pods={pods} namespace={namespace} />}
      </div>
    </div>
  );
}

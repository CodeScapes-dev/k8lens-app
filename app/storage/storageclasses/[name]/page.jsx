"use client";
import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, DatabaseIcon, BellIcon, TagIcon, ShareIcon } from "lucide-react";
import { DependencyGraph } from "@/components/dependency-graph/DependencyGraph";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge } from "@/lib/k8s/utils";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { OverviewTab } from "@/components/storageclass-detail/tabs/OverviewTab";
import { ResourcesTab } from "@/components/storageclass-detail/tabs/ResourcesTab";
import { QuickStat } from "@/components/detail/helpers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Resources", icon: DatabaseIcon },
  { id: "Dependencies", icon: ShareIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

export default function StorageClassDetailPage() {
  const { name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("storageclass", null, name);
  const [activeTab, setActiveTab] = React.useState("Overview");
  const sc = data?.storageClass ?? null;
  const pvs = data?.pvs ?? [];
  const pvcs = data?.pvcs ?? [];
  const workloads = data?.workloads ?? [];
  const events = data?.events ?? [];
  const isDefault = sc?.metadata?.annotations?.["storageclass.kubernetes.io/is-default-class"] === "true";

  if (error) return (
    <div className="flex flex-col items-center gap-3 pt-20 px-4">
      <p className="text-sm text-destructive">{error}</p>
      <button onClick={refresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer border-none">Retry</button>
    </div>
  );

  return (
    <div>
      <div className="sm:sticky sm:top-0 sm:z-10 bg-background border-b border-border px-4 sm:px-7 pt-4">
        {loading ? (
          <div className="space-y-3 pb-4">
            <Skeleton className="h-4 w-40" /><Skeleton className="h-7 w-72" /><Skeleton className="h-5 w-full max-w-sm" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1 space-y-2">
                <span className="font-mono text-xs text-muted-foreground">StorageClass · storage.k8s.io/v1 · cluster-scoped</span>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {isDefault && <Badge variant="secondary" className="font-mono text-[10.5px] font-normal">Default</Badge>}
                  {sc?.provisioner && <Badge variant="secondary" className="font-mono text-[10.5px] font-normal">{sc.provisioner}</Badge>}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-3 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[240px] sm:min-w-0">
                  <QuickStat label="PVs" value={pvs.length} />
                  <QuickStat label="PVCs" value={pvcs.length} />
                  <QuickStat label="Age" value={sc?.metadata?.creationTimestamp ? calculateAge(sc.metadata.creationTimestamp) : "—"} />
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
      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && <OverviewTab sc={sc} pvs={pvs} pvcs={pvcs} workloads={workloads} />}
        {activeTab === "Resources" && <ResourcesTab pvs={pvs} pvcs={pvcs} />}
        {activeTab === "Dependencies" && <DependencyGraph resourceType="storageclass" resource={sc} />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={sc} />}
      </div>
    </div>
  );
}

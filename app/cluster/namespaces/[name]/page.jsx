"use client";
import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, LayersIcon, TagIcon } from "lucide-react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { OverviewTab } from "@/components/namespace-detail/tabs/OverviewTab";
import { ResourcesTab } from "@/components/namespace-detail/tabs/ResourcesTab";
import { QuickStat } from "@/components/detail/helpers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Resources", icon: LayersIcon },
  { id: "Metadata", icon: TagIcon },
];

export default function NamespaceDetailPage() {
  const { name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("namespace", null, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const ns = data?.ns ?? null;
  const pods = data?.pods ?? [];
  const deployments = data?.deployments ?? [];
  const services = data?.services ?? [];
  const configMaps = data?.configMaps ?? [];
  const secrets = data?.secrets ?? [];
  const daemonSets = data?.daemonSets ?? [];
  const statefulSets = data?.statefulSets ?? [];
  const replicaSets = data?.replicaSets ?? [];
  const jobs = data?.jobs ?? [];
  const cronJobs = data?.cronJobs ?? [];
  const ingresses = data?.ingresses ?? [];
  const quotas = data?.quotas ?? [];
  const limits = data?.limits ?? [];

  const phase = ns?.status?.phase ?? "Unknown";
  const totalResources = pods.length + deployments.length + services.length + configMaps.length + secrets.length + daemonSets.length + statefulSets.length + jobs.length + cronJobs.length + ingresses.length;

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
            <Skeleton className="h-4 w-40" /><Skeleton className="h-7 w-72" /><Skeleton className="h-5 w-40" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <KLStatus kind={phase === "Active" ? "ok" : "err"} dotOnly />
                  <span className="font-mono text-xs text-muted-foreground">Namespace · v1 · cluster-scoped</span>
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className={`font-mono text-[10.5px] font-normal ${phase === "Active" ? "text-green-600" : "text-destructive"}`}>{phase}</Badge>
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-4 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[260px] sm:min-w-0">
                  <QuickStat label="Pods" value={pods.length} />
                  <QuickStat label="Deploys" value={deployments.length} />
                  <QuickStat label="Services" value={services.length} />
                  <QuickStat label="Age" value={ns?.metadata?.creationTimestamp ? calculateAge(ns.metadata.creationTimestamp) : "—"} />
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
                      {id === "Resources" && totalResources > 0 && <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{totalResources}</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && <OverviewTab ns={ns} pods={pods} deployments={deployments} services={services} configMaps={configMaps} secrets={secrets} daemonSets={daemonSets} statefulSets={statefulSets} jobs={jobs} cronJobs={cronJobs} ingresses={ingresses} quotas={quotas} limits={limits} />}
        {activeTab === "Resources" && <ResourcesTab pods={pods} deployments={deployments} services={services} configMaps={configMaps} secrets={secrets} daemonSets={daemonSets} statefulSets={statefulSets} jobs={jobs} cronJobs={cronJobs} ingresses={ingresses} quotas={quotas} limits={limits} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={ns} />}
      </div>
    </div>
  );
}

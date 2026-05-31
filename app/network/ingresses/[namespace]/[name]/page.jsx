"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, LockIcon, NetworkIcon, BellIcon, TagIcon } from "lucide-react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge } from "@/lib/k8s/utils";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { OverviewTab } from "@/components/ingress-detail/tabs/OverviewTab";
import { TLSTab } from "@/components/ingress-detail/tabs/TLSTab";
import { RulesTab } from "@/components/ingress-detail/tabs/RulesTab";
import { HealthBadge } from "@/components/health-score/HealthBadge";
import { Recommendations } from "@/components/recommendations/Recommendations";
import { QuickStat } from "@/components/detail/helpers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "TLS", icon: LockIcon },
  { id: "Rules", icon: NetworkIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

export default function IngressDetailPage() {
  const { namespace, name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("ingress", namespace, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const ingress = data?.ingress ?? null;
  const events = data?.events ?? [];
  const tls = ingress?.spec?.tls ?? [];
  const rules = ingress?.spec?.rules ?? [];
  const labels = ingress?.metadata?.labels ?? {};

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
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">Ingress · networking.k8s.io/v1 · {namespace}</span>
                  {ingress && <HealthBadge resourceType="ingress" data={data} />}
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(labels).slice(0, 6).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="font-mono text-[10.5px] font-normal break-all">{k}={v}</Badge>
                  ))}
                  {tls.length > 0 && <Badge variant="secondary" className="font-mono text-[10.5px] font-normal">TLS</Badge>}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-4 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[300px] sm:min-w-0">
                  <QuickStat label="Rules" value={rules.length} />
                  <QuickStat label="TLS" value={tls.length} />
                  <QuickStat label="Class" value={ingress?.spec?.ingressClassName ?? "—"} />
                  <QuickStat label="Age" value={ingress?.metadata?.creationTimestamp ? calculateAge(ingress.metadata.creationTimestamp) : "—"} />
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

      {ingress && <Recommendations resourceType="ingress" data={data} namespace={namespace} name={name} />}

      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && <OverviewTab ingress={ingress} />}
        {activeTab === "TLS" && <TLSTab ingress={ingress} />}
        {activeTab === "Rules" && <RulesTab ingress={ingress} />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={ingress} />}
      </div>
    </div>
  );
}

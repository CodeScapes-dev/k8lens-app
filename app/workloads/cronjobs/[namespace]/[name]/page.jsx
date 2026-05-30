"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, CpuIcon, HistoryIcon, BellIcon, TagIcon } from "lucide-react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { RunHistoryTab } from "@/components/cronjob-detail/tabs/RunHistoryTab";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Resources", icon: CpuIcon },
  { id: "Run History", icon: HistoryIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

function QuickStat({ label, value }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">{label}</span>
      <span className="font-mono text-sm font-bold leading-none">{value}</span>
    </div>
  );
}

export default function CronJobDetailPage() {
  const { namespace, name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("cronjob", namespace, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const cj = data?.cronJob ?? null;
  const jobs = data?.jobs ?? [];
  const events = data?.events ?? [];
  const containers = cj?.spec?.jobTemplate?.spec?.template?.spec?.containers ?? [];

  const suspended = cj?.spec?.suspend ?? false;
  const labels = cj?.metadata?.labels ?? {};

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
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${suspended ? "bg-yellow-500" : "bg-green-500"}`} />
                  <span className="font-mono text-xs text-muted-foreground">CronJob · batch/v1 · {namespace}</span>
                  {suspended && <Badge variant="outline" className="font-mono text-[10.5px] border-yellow-500/40 bg-yellow-500/10 text-yellow-600">Suspended</Badge>}
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
                  <QuickStat label="Schedule" value={cj?.spec?.schedule ?? "—"} />
                  <QuickStat label="Jobs" value={jobs.length} />
                  <QuickStat label="Age" value={cj?.metadata?.creationTimestamp ? calculateAge(cj.metadata.creationTimestamp) : "—"} />
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
        {activeTab === "Overview" && (
          <Panel title="CronJob Details">
            <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(120px, 180px) 1fr", fontSize: 12 }}>
              <span style={{ color: "var(--kl-text-muted)" }}>Schedule</span><span className="kl-mono">{cj?.spec?.schedule ?? "—"}</span>
              <span style={{ color: "var(--kl-text-muted)" }}>Concurrency Policy</span><span className="kl-mono">{cj?.spec?.concurrencyPolicy ?? "Allow"}</span>
              <span style={{ color: "var(--kl-text-muted)" }}>Suspend</span><span className="kl-mono">{suspended ? "Yes" : "No"}</span>
              <span style={{ color: "var(--kl-text-muted)" }}>Successful Jobs History</span><span className="kl-mono">{cj?.spec?.successfulJobsHistoryLimit ?? 3}</span>
              <span style={{ color: "var(--kl-text-muted)" }}>Failed Jobs History</span><span className="kl-mono">{cj?.spec?.failedJobsHistoryLimit ?? 1}</span>
              <span style={{ color: "var(--kl-text-muted)" }}>Last Schedule Time</span><span className="kl-mono">{cj?.status?.lastScheduleTime ? new Date(cj.status.lastScheduleTime).toLocaleString() : "—"}</span>
            </div>
          </Panel>
        )}
        {activeTab === "Resources" && (
          <div className="flex flex-col gap-4">
            {containers.length > 0 && (
              <Panel title="Container Template" subtitle="Container specifications for jobs created by this CronJob" style={{ overflow: "hidden" }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Name</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Image</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Ports</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Requests</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Limits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {containers.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-mono text-xs font-semibold">{c.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate" title={c.image}>{c.image}</TableCell>
                        <TableCell className="font-mono text-xs">{c.ports?.map((p) => `${p.containerPort}/${p.protocol ?? "TCP"}`).join(", ") || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{c.resources?.requests ? Object.entries(c.resources.requests).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{c.resources?.limits ? Object.entries(c.resources.limits).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            )}
            {containers.length === 0 && (
              <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No container template found.</span>
            )}
          </div>
        )}
        {activeTab === "Run History" && <RunHistoryTab jobs={jobs} />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={cj} />}
      </div>
    </div>
  );
}

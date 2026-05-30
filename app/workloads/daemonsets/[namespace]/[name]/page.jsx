"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, CpuIcon, BellIcon, TagIcon, ShareIcon } from "lucide-react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { HealthBadge } from "@/components/health-score/HealthBadge";
import { Recommendations } from "@/components/recommendations/Recommendations";
import { CostCard } from "@/components/cost-estimation/CostCard";
import { DependencyGraph } from "@/components/dependency-graph/DependencyGraph";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Resources", icon: CpuIcon },
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

function parseCpu(cpu = "0") {
  if (!cpu) return 0;
  return cpu.endsWith("m") ? parseInt(cpu) : parseInt(cpu) * 1000;
}
function parseMem(mem = "0") {
  if (!mem) return 0;
  if (mem.endsWith("Mi")) return parseFloat(mem);
  if (mem.endsWith("Gi")) return parseFloat(mem) * 1024;
  return 0;
}

export default function DaemonSetDetailPage() {
  const router = useRouter();
  const { namespace, name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("daemonset", namespace, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const ds = data?.daemonSet ?? null;
  const pods = data?.pods ?? [];
  const events = data?.events ?? [];

  const desired = ds?.status?.desiredNumberScheduled ?? 0;
  const ready = ds?.status?.numberReady ?? 0;
  const labels = ds?.metadata?.labels ?? {};
  const containers = ds?.spec?.template?.spec?.containers ?? [];

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
                  {ds && <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor(desired, ready)}`} />}
                  <span className="font-mono text-xs text-muted-foreground">DaemonSet · apps/v1 · {namespace}</span>
                  {ds && <HealthBadge resourceType="daemonset" data={data} />}
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
                  <QuickStat label="Age" value={ds?.metadata?.creationTimestamp ? calculateAge(ds.metadata.creationTimestamp) : "—"} />
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

      {ds && <Recommendations resourceType="daemonset" data={data} namespace={namespace} name={name} />}

      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && (
          <div className="flex flex-col gap-4">
            <CostCard containers={containers} replicas={pods.length} />
            <Panel title="Status">
              <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(120px, 180px) 1fr", fontSize: 12 }}>
                <span style={{ color: "var(--kl-text-muted)" }}>Desired</span><span className="kl-mono">{ds?.status?.desiredNumberScheduled ?? 0}</span>
                <span style={{ color: "var(--kl-text-muted)" }}>Ready</span><span className="kl-mono">{ds?.status?.numberReady ?? 0}</span>
                <span style={{ color: "var(--kl-text-muted)" }}>Available</span><span className="kl-mono">{ds?.status?.numberAvailable ?? 0}</span>
                <span style={{ color: "var(--kl-text-muted)" }}>Misscheduled</span><span className="kl-mono">{ds?.status?.numberMisscheduled ?? 0}</span>
              </div>
            </Panel>
          </div>
        )}
        {activeTab === "Resources" && (
          <div className="flex flex-col gap-4">
            {/* Container Template */}
            {containers.length > 0 && (
              <Panel title="Container Template" subtitle="Container specifications for pods created by this DaemonSet" style={{ overflow: "hidden" }}>
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
                        <TableCell className="font-mono text-xs">
                          {c.ports?.map((p) => `${p.containerPort}/${p.protocol ?? "TCP"}`).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {c.resources?.requests ? Object.entries(c.resources.requests).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {c.resources?.limits ? Object.entries(c.resources.limits).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            )}

            {/* Managed Pods */}
            {pods.length > 0 && (
              <Panel title="Managed Pods" subtitle={`Pods controlled by this DaemonSet`} style={{ overflow: "hidden" }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-6" />
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Name</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[80px]">Restarts</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[70px]">Ready</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[90px]">Status</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[80px]">CPU</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[90px]">Memory</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[110px]">IP</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Node</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[60px]">Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pods.map((pod) => {
                      const phase = pod.status?.phase ?? "Unknown";
                      const pkind = phase === "Running" ? "ok" : phase === "Pending" ? "warn" : "err";
                      const restarts = (pod.status?.containerStatuses ?? []).reduce((s, c) => s + (c.restartCount ?? 0), 0);
                      const totalC = pod.spec?.containers?.length ?? 0;
                      const readyC = (pod.status?.containerStatuses ?? []).filter((c) => c.ready).length;
                      const podContainers = pod.spec?.containers ?? [];
                      const cpuM = podContainers.reduce((s, c) => s + parseCpu(c.resources?.requests?.cpu), 0);
                      const memMi = podContainers.reduce((s, c) => s + parseMem(c.resources?.requests?.memory), 0);
                      const podNode = pod.spec?.nodeName ?? "—";
                      return (
                        <TableRow
                          key={pod.metadata?.uid}
                          className="cursor-pointer"
                          onClick={() => router.push(`/workloads/pods/${pod.metadata?.namespace ?? namespace}/${pod.metadata?.name}`)}
                        >
                          <TableCell><KLStatus kind={pkind} dotOnly /></TableCell>
                          <TableCell className="font-mono text-xs text-[var(--kl-accent)] max-w-[180px] truncate">{pod.metadata?.name}</TableCell>
                          <TableCell className="font-mono text-xs">{restarts}</TableCell>
                          <TableCell className="font-mono text-xs">{readyC}/{totalC}</TableCell>
                          <TableCell><KLBadge tone={pkind}>{phase}</KLBadge></TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{(cpuM / 1000).toFixed(2)} m</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{memMi.toFixed(1)} Mi</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{pod.status?.podIP ?? "—"}</TableCell>
                          <TableCell
                            className="font-mono text-xs text-[var(--kl-accent)] truncate max-w-[120px] cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); if (podNode !== "—") router.push(`/cluster/nodes/${podNode}`); }}
                          >{podNode}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{pod.metadata?.creationTimestamp ? calculateAge(pod.metadata.creationTimestamp) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Panel>
            )}
          </div>
        )}
        {activeTab === "Dependencies" && <DependencyGraph resourceType="daemonset" resource={ds} />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={ds} />}
      </div>
    </div>
  );
}
